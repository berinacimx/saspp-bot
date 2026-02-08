require("dotenv").config()
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ActivityType
} = require("discord.js")

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
})

/* ================= GUARD ================= */
process.on("unhandledRejection", () => {})
process.on("uncaughtException", () => {})

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`✅ ${client.user.tag} aktif`)

  const guild = client.guilds.cache.get(process.env.GUILD_ID)
  if (!guild) return

  await guild.members.fetch().catch(() => {})

  setInterval(() => updatePresence(guild), 60_000)
  updatePresence(guild)
})

/* ================= PRESENCE ================= */
async function updatePresence(guild) {
  const members = await guild.members.fetch().catch(() => null)
  if (!members) return

  const online = members.filter(
    m => !m.user.bot && m.presence && m.presence.status !== "offline"
  ).size

  const total = members.filter(m => !m.user.bot).size

  client.user.setPresence({
    activities: [
      {
        name: `${online} Online | ${total} Üye`,
        type: ActivityType.Watching
      }
    ],
    status: "online"
  })
}

/* ================= INTERACTION ================= */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return
  const { guild, user, customId, channel } = interaction

  await interaction.deferUpdate().catch(() => {})

  /* ===== TICKET KAPAT ===== */
  if (customId === "ticket_kapat") {
    if (!channel?.name?.startsWith("ticket-")) return

    const log = guild.channels.cache.get(process.env.TICKET_LOG_KANAL_ID)
    if (log) log.send(`🔒 Ticket kapatıldı | ${channel.name} | <@${user.id}>`)

    return setTimeout(() => {
      channel.delete().catch(() => {})
    }, 3000)
  }

  /* ===== TICKET OLUŞTUR ===== */
  if (!customId.startsWith("ticket_")) return

  const exists = guild.channels.cache.find(
    c => c.name === `ticket-${user.id}`
  )

  if (exists) {
    return interaction.followUp({
      content: "❌ Zaten açık bir ticketin var.",
      ephemeral: true
    })
  }

  const ticketChannel = await guild.channels.create({
    name: `ticket-${user.id}`,
    type: ChannelType.GuildText,
    parent: process.env.TICKET_KATEGORI_ID,
    permissionOverwrites: [
      {
        id: guild.roles.everyone,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages
        ]
      },
      {
        id: process.env.TICKET_YETKILI_ROL_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages
        ]
      }
    ]
  })

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_kapat")
      .setLabel("Ticket Kapat")
      .setStyle(ButtonStyle.Danger)
  )

  await ticketChannel.send({
    content: `<@${user.id}> | <@&${process.env.TICKET_YETKILI_ROL_ID}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle("🎫 Ticket Açıldı")
        .setDescription("Yetkililer sizinle ilgilenecek.")
        .setTimestamp()
    ],
    components: [row]
  })

  await interaction.followUp({
    content: "✅ Ticket oluşturuldu.",
    ephemeral: true
  })
})

/* ================= LOGIN ================= */
client.login(process.env.TOKEN)
