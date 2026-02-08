require("dotenv").config()

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

let reconnecting = false

/* ================= UPTIME ================= */

http.createServer((_, res) => {
  res.writeHead(200)
  res.end("OK")
}).listen(process.env.PORT || 3000)

/* ================= VOICE GUARD ================= */

async function connectVoice() {
  if (reconnecting) return
  reconnecting = true

  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null)
    if (!guild) throw new Error("Guild yok")

    const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID)
    if (!channel || !channel.isVoiceBased()) throw new Error("Ses kanalı geçersiz")

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
        setTimeout(() => {
          reconnecting = false
          connectVoice()
        }, 8000)
      }
    })

  } catch {
    reconnecting = false
    setTimeout(connectVoice, 12_000)
  }
}

/* ================= READY ================= */

client.once(Events.ClientReady, async () => {
  console.log(`🟢 Bot aktif: ${client.user.tag}`)

  setTimeout(connectVoice, 5000)

  /* PRESENCE */
  let mode = 0
  setInterval(async () => {
    const guild = client.guilds.cache.get(process.env.GUILD_ID)
    if (!guild) return

    await guild.members.fetch({ withPresences: true })

    const total = guild.memberCount
    const online = guild.members.cache.filter(
      m => m.presence && m.presence.status !== "offline"
    ).size

    const activities = [
      { name: `${online} Çevrimiçi | ${total} Üye`, type: ActivityType.Watching },
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
      .setTitle("🎫 Destek Talepleri")
      .setDescription(
        "Aşağıdaki butonları kullanarak destek talebi oluşturabilirsiniz.\n\n" +
        "👮‍♂️ Şikayet\n📝 Başvuru\n❓ Destek"
      )

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_sikayet").setLabel("Şikayet").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ticket_basvuru").setLabel("Başvuru").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ticket_destek").setLabel("Destek").setStyle(ButtonStyle.Secondary)
    )

    await panel.send({ embeds: [embed], components: [row] })
  }
})

/* ================= MEMBER ADD ================= */

client.on(Events.GuildMemberAdd, async member => {
  try {
    const role = member.guild.roles.cache.get(process.env.OTOROL_ID)
    if (role) await member.roles.add(role).catch(() => {})

    const welcome = member.guild.channels.cache.get(process.env.HOSGELDIN_KANAL_ID)
    if (welcome) {
      await welcome.send(`<@${member.id}> Sunucumuza hoş geldin 👋`)
    }

    const tags = (process.env.ETIKET_KANALLAR || "")
      .split(",").map(x => x.trim()).filter(Boolean)

    for (const id of tags) {
      const ch = member.guild.channels.cache.get(id)
      if (!ch) continue
      const msg = await ch.send(`<@${member.id}>`)
      setTimeout(() => msg.delete().catch(() => {}), 3000)
    }
  } catch {}
})

/* ================= TICKET SYSTEM ================= */

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return

  const { guild, user, customId } = interaction

  /* CREATE */
  if (customId.startsWith("ticket_")) {
    const existing = guild.channels.cache.find(c => c.name === `ticket-${user.id}`)
    if (existing)
      return interaction.reply({ content: "❌ Zaten açık ticketin var.", ephemeral: true })

    const channel = await guild.channels.create({
      name: `ticket-${user.id}`,
      type: ChannelType.GuildText,
      parent: process.env.TICKET_KATEGORI_ID,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: process.env.TICKET_YETKILI_ROL_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    })

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_kapat")
        .setLabel("Ticket Kapat")
        .setStyle(ButtonStyle.Danger)
    )

    await channel.send({
      content: `<@${user.id}> | <@&${process.env.TICKET_YETKILI_ROL_ID}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(0x2f3136)
          .setTitle("🎫 Ticket Oluşturuldu")
          .setDescription("Yetkililer sizinle ilgilenecektir.")
      ],
      components: [closeRow]
    })

    return interaction.reply({ content: "✅ Ticket oluşturuldu.", ephemeral: true })
  }

  /* CLOSE */
  if (customId === "ticket_kapat") {
    const log = guild.channels.cache.get(process.env.TICKET_LOG_KANAL_ID)
    if (log) log.send(`🔒 Ticket kapatıldı | ${interaction.channel.name}`)

    await interaction.reply({ content: "Ticket kapatılıyor...", ephemeral: true })
    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000)
  }
})

/* ================= GUARD ================= */

process.on("unhandledRejection", () => {})
process.on("uncaughtException", () => {})

/* ================= LOGIN ================= */

client.login(process.env.TOKEN)
