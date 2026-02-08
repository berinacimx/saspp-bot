require("dotenv").config()

/* ================= IMPORTS ================= */

const {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField
} = require("discord.js")

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection
} = require("@discordjs/voice")

const http = require("http")

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
  ]
})

/* ================= UPTIME ================= */

http.createServer((_, res) => {
  res.writeHead(200)
  res.end("OK")
}).listen(process.env.PORT || 3000)

/* ================= VOICE GUARD ================= */

let reconnecting = false

async function connectVoice() {
  if (reconnecting) return
  reconnecting = true

  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID)
    const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID)
    if (!channel?.isVoiceBased()) throw "Voice channel error"

    if (getVoiceConnection(guild.id)) {
      reconnecting = false
      return
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
      encryptionMode: "aead_xchacha20_poly1305_rtpsize"
    })

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000)
    reconnecting = false

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
        ])
      } catch {
        reconnecting = false
        setTimeout(connectVoice, 8000)
      }
    })
  } catch {
    reconnecting = false
    setTimeout(connectVoice, 12_000)
  }
}

/* ================= READY ================= */

client.once(Events.ClientReady, async () => {
  console.log(`🟢 Aktif: ${client.user.tag}`)
  setTimeout(connectVoice, 5000)

  /* PRESENCE */
  let mode = 0
  setInterval(async () => {
    const g = client.guilds.cache.get(process.env.GUILD_ID)
    if (!g) return
    await g.members.fetch({ withPresences: true })

    const online = g.members.cache.filter(m => m.presence?.status !== "offline").size
    const total = g.memberCount

    const activities = [
      { name: `${online} Online | ${total} Üye`, type: ActivityType.Watching },
      { name: "San Andreas State Police", type: ActivityType.Playing }
    ]

    client.user.setPresence({
      activities: [activities[mode]],
      status: "online"
    })

    mode = (mode + 1) % activities.length
  }, 60_000)

  /* TICKET PANEL */
  const panel = await client.channels.fetch(process.env.TICKET_KANAL_ID).catch(() => null)
  if (panel) {
    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setTitle("🎫 Destek Merkezi")
      .setDescription("Aşağıdan destek türünü seçiniz.")

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_sikayet").setLabel("Şikayet").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ticket_basvuru").setLabel("Başvuru").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ticket_destek").setLabel("Destek").setStyle(ButtonStyle.Secondary)
    )

    await panel.bulkDelete(5).catch(() => {})
    await panel.send({ embeds: [embed], components: [row] })
  }
})

/* ================= MEMBER ADD ================= */

client.on(Events.GuildMemberAdd, async member => {
  try {
    const role = member.guild.roles.cache.get(process.env.OTOROL_ID)
    if (role) await member.roles.add(role)

    const welcome = member.guild.channels.cache.get(process.env.HOSGELDIN_KANAL_ID)
    if (welcome) welcome.send(`<@${member.id}> Sunucumuza hoş geldin 👋`)
  } catch {}
})

/* ================= TICKET SYSTEM ================= */

const ticketCooldown = new Map()

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return

  const { guild, user, customId, channel } = interaction
  await interaction.deferReply({ ephemeral: true })

  /* CLOSE */
  if (customId === "ticket_kapat") {
    if (!channel.name.startsWith("ticket-"))
      return interaction.editReply("❌ Bu bir ticket değil.")

    const log = guild.channels.cache.get(process.env.TICKET_LOG_KANAL_ID)
    if (log)
      log.send(`🔒 Ticket kapatıldı: **${channel.name}** | <@${user.id}>`)

    interaction.editReply("🔒 Ticket kapatılıyor...")
    return setTimeout(() => channel.delete().catch(() => {}), 5000)
  }

  /* CREATE */
  if (!customId.startsWith("ticket_")) return

  const last = ticketCooldown.get(user.id)
  if (last && Date.now() - last < 30000)
    return interaction.editReply("⏳ 30 saniye beklemelisin.")

  ticketCooldown.set(user.id, Date.now())

  if (guild.channels.cache.find(c => c.name === `ticket-${user.id}`))
    return interaction.editReply("❌ Zaten açık ticketin var.")

  const channelCreated = await guild.channels.create({
    name: `ticket-${user.id}`,
    type: ChannelType.GuildText,
    parent: process.env.TICKET_KATEGORI_ID,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: process.env.TICKET_YETKILI_ROL_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  })

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_kapat").setLabel("Ticket Kapat").setStyle(ButtonStyle.Danger)
  )

  await channelCreated.send({
    content: `<@${user.id}> | <@&${process.env.TICKET_YETKILI_ROL_ID}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle("🎫 Ticket Açıldı")
        .setDescription("Yetkililer sizinle ilgilenecektir.")
        .setTimestamp()
    ],
    components: [row]
  })

  interaction.editReply("✅ Ticket oluşturuldu.")
})

/* ================= GUARD ================= */

process.on("unhandledRejection", () => {})
process.on("uncaughtException", () => {})

/* ================= LOGIN ================= */

client.login(process.env.TOKEN)
