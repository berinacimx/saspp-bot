/* ======================================================
   🔐 VOICE ENCRYPTION FIX (EN ÜSTE)
====================================================== */
process.env.DISCORDJS_VOICE_FORCE_AES256 = "true"
require("dotenv").config()

/* ======================================================
   📦 IMPORTS
====================================================== */
const {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType
} = require("discord.js")

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus
} = require("@discordjs/voice")

const http = require("http")

/* ======================================================
   🤖 CLIENT
====================================================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
  ]
})

/* ======================================================
   🌐 UPTIME (Railway / Render / Replit uyumlu)
====================================================== */
http.createServer((req, res) => {
  res.writeHead(200)
  res.end("OK")
}).listen(process.env.PORT || 3000)

/* ======================================================
   🔊 SES KANALI (AUTO RECONNECT)
====================================================== */
async function connectVoice() {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID)
    if (!guild) return

    const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID)
    if (!channel || !channel.isVoiceBased()) return

    if (getVoiceConnection(guild.id)) return

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    })

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log("🔊 Ses kanalına bağlanıldı")
    })

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log("⚠️ Ses düştü, yeniden bağlanıyor...")
      setTimeout(connectVoice, 5000)
    })
  } catch (err) {
    console.error("Ses bağlantı hatası:", err.message)
    setTimeout(connectVoice, 5000)
  }
}

/* ======================================================
   🟢 READY
====================================================== */
client.once(Events.ClientReady, async () => {
  console.log(`🟢 Aktif: ${client.user.tag}`)

  await connectVoice()

  const guild = await client.guilds.fetch(process.env.GUILD_ID)
  let mode = 0

  setInterval(async () => {
    try {
      await guild.members.fetch({ withPresences: true })

      const total = guild.memberCount
      const online = guild.members.cache.filter(
        m => m.presence && m.presence.status !== "offline"
      ).size

      const activity =
        mode === 0
          ? { name: `${online} Online | ${total} Üye`, type: ActivityType.Watching }
          : { name: "San Andreas State Police #DESTAN", type: ActivityType.Playing }

      client.user.setPresence({
        activities: [activity],
        status: "online"
      })

      mode = (mode + 1) % 2
    } catch (e) {
      console.error("Presence hatası:", e.message)
    }
  }, 15000)
})

/* ======================================================
   👤 ÜYE GİRİNCE
====================================================== */
client.on(Events.GuildMemberAdd, async member => {
  try {
    /* 👋 HOŞGELDİN */
    const welcome = member.guild.channels.cache.get(process.env.HOSGELDIN_KANAL_ID)
    if (welcome) {
      await welcome.send(
        `<@${member.id}> Sunucumuza hoş geldin 👋\n` +
        `Başvuru ve bilgilendirme kanallarını incelemeyi unutma.\n\n` +
        `**San Andreas State Police #𝐃𝐄𝐒𝐓𝐀𝐍**`
      )
    }

    /* 🔔 ETİKET AT → SİL */
    const kanalList = (process.env.ETIKET_KANALLAR || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean)

    for (const id of kanalList) {
      const ch = member.guild.channels.cache.get(id)
      if (!ch) continue

      const msg = await ch.send(`<@${member.id}>`)
      setTimeout(() => msg.delete().catch(() => {}), 3000)
    }
  } catch (err) {
    console.error("Üye giriş hatası:", err)
  }
})

/* ======================================================
   🛡️ GLOBAL KORUMA (CRASH YEMEZ)
====================================================== */
process.on("unhandledRejection", err => {
  console.error("Unhandled Rejection:", err)
})

process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err)
})

client.on("error", console.error)

/* ======================================================
   🔐 LOGIN
====================================================== */
client.login(process.env.TOKEN)
