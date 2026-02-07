require("dotenv").config()

const {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType
} = require("discord.js")

const http = require("http")

/* ========= CLIENT ========= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
})

/* ========= UPTIME ========= */
http.createServer((req, res) => {
  res.writeHead(200)
  res.end("OK")
}).listen(process.env.PORT || 3000)

/* ========= READY ========= */
client.once(Events.ClientReady, async () => {
  console.log(`🟢 Aktif: ${client.user.tag}`)

  const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null)
  if (!guild) return console.error("❌ Guild bulunamadı")

  let mode = 0

  const updatePresence = async () => {
    try {
      await guild.members.fetch({ withPresences: true })

      const total = guild.memberCount
      const online = guild.members.cache.filter(
        m => m.presence && m.presence.status !== "offline"
      ).size

      const activity =
        mode === 0
          ? {
              name: `${online} Online | ${total} Üye`,
              type: ActivityType.Watching
            }
          : {
              name: "San Andreas State Police #DESTAN",
              type: ActivityType.Playing
            }

      client.user.setPresence({
        activities: [activity],
        status: "online"
      })

      mode = (mode + 1) % 2
    } catch (err) {
      console.error("Presence error:", err.message)
    }
  }

  updatePresence()
  setInterval(updatePresence, 15_000)
})

/* ========= HOŞGELDİN ========= */
client.on(Events.GuildMemberAdd, async member => {
  try {
    const welcomeChannel =
      member.guild.channels.cache.get(process.env.HOSGELDIN_KANAL_ID)

    if (welcomeChannel) {
      await welcomeChannel.send(
        `<@${member.id}> Sunucumuza hoş geldin 👋\n` +
        `Başvuru için <#${process.env.BASVURU_KANAL_ID}> kanalını inceleyebilirsin.\n\n` +
        `**San Andreas State Police #𝐃𝐄𝐒𝐓𝐀𝐍**`
      )
    }

    const tagChannels =
      process.env.ETIKET_KANALLAR?.split(",") || []

    for (const id of tagChannels) {
      const ch = member.guild.channels.cache.get(id)
      if (!ch) continue

      const msg = await ch.send(`<@${member.id}>`)
      setTimeout(() => msg.delete().catch(() => {}), 3000)
    }
  } catch (err) {
    console.error("GuildMemberAdd error:", err.message)
  }
})

/* ========= GÜVENLİK ========= */
process.on("unhandledRejection", err => {
  console.error("Unhandled:", err)
})

client.on("error", err => {
  console.error("Client error:", err)
})

client.login(process.env.TOKEN)
