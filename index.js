/* 🔐 VOICE ENCRYPTION FIX (EN ÜSTE) */
process.env.DISCORDJS_VOICE_FORCE_AES256 = "true"
require("dotenv").config()

const {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType
} = require("discord.js")

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState
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
http.createServer((req, res) => {
  res.writeHead(200)
  res.end("OK")
}).listen(process.env.PORT || 3000)

/* ================= SES SİSTEMİ ================= */
async function connectVoice(force = false) {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID)
    if (!guild) return

    const channel = await guild.channels.fetch(process.env.VOICE_CHANNEL_ID)
    if (!channel || !channel.isVoiceBased()) {
      console.log("❌ Ses kanalı bulunamadı")
      return
    }

    const existing = getVoiceConnection(guild.id)
    if (existing && !force) return

    if (existing) existing.destroy()

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

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log("⚠️ Ses düştü, yeniden bağlanılıyor...")
      setTimeout(() => connectVoice(true), 5000)
    })

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.log("❌ Ses bağlantısı destroy oldu, yeniden başlatılıyor...")
      setTimeout(() => connectVoice(true), 5000)
    })

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000)

  } catch (err) {
    console.error("Ses bağlantı hatası:", err.message)
    setTimeout(() => connectVoice(true), 5000)
  }
}

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`🟢 Aktif: ${client.user.tag}`)

  await connectVoice()

  const guild = await client.guilds.fetch(process.env.GUILD_ID)
  let mode = 0

  /* 🔥 RATE-LIMIT SAFE PRESENCE */
  setInterval(() => {
    try {
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
    } catch {}
  }, 60000) // ⏱️ 60 sn = SAFE
})

/* ================= ÜYE GİRİNCE ================= */
client.on(Events.GuildMemberAdd, async member => {
  try {
    const welcome = member.guild.channels.cache.get(process.env.HOSGELDIN_KANAL_ID)
    if (welcome) {
      await welcome.send(
        `<@${member.id}> Sunucumuza hoş geldin 👋\n` +
        `Başvuru ve bilgilendirme kanallarını incelemeyi unutma.\n\n` +
        `**San Andreas State Police #𝐃𝐄𝐒𝐓𝐀𝐍**`
      )
    }

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

/* ================= KORUMA ================= */
process.on("unhandledRejection", err => {
  console.error("Unhandled Rejection:", err)
})

process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err)
})

client.on("error", console.error)

/* ================= LOGIN ================= */
client.login(process.env.TOKEN)
