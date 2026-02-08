require("dotenv").config()

const { 
  Client, 
  GatewayIntentBits, 
  Events, 
  ActivityType 
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

/* ================= VOICE ================= */

async function connectVoice() {
  try {
    console.log("🎧 Ses bağlantısı deneniyor...")

    const guild = client.guilds.cache.get(process.env.GUILD_ID)
    if (!guild) return console.log("❌ Guild bulunamadı")

    const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID)
    if (!channel) return console.log("❌ Ses kanalı bulunamadı")

    if (!channel.isVoiceBased())
      return console.log("❌ Kanal ses kanalı değil")

    if (getVoiceConnection(guild.id)) {
      console.log("ℹ️ Zaten sese bağlı")
      return
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    })

    await entersState(connection, VoiceConnectionStatus.Ready, 15_000)
    console.log("🔊 Bot sese başarıyla bağlandı")

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log("⚠️ Ses bağlantısı koptu, tekrar bağlanılıyor...")
      setTimeout(connectVoice, 8000)
    })

  } catch (err) {
    console.error("🔴 Ses hatası:", err)
    setTimeout(connectVoice, 10_000)
  }
}

/* ================= READY ================= */

client.once(Events.ClientReady, async () => {
  console.log(`🟢 Bot aktif: ${client.user.tag}`)

  await connectVoice()

  let mode = 0
  setInterval(async () => {
    try {
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
    } catch {}
  }, 60_000)
})

/* ================= MEMBER ADD ================= */

client.on(Events.GuildMemberAdd, async member => {
  try {
    const welcome = member.guild.channels.cache.get(process.env.HOSGELDIN_KANAL_ID)
    if (welcome) {
      await welcome.send(
        `<@${member.id}> Sunucumuza hoş geldin 👋\n` +
        `Başvuru ve bilgilendirme kanallarını incelemeyi unutma.\n\n` +
        `San Andreas State Police #𝐃𝐄𝐒𝐓𝐀𝐍`
      )
    }

    const list = (process.env.ETIKET_KANALLAR || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean)

    for (const id of list) {
      const ch = member.guild.channels.cache.get(id)
      if (!ch) continue

      const msg = await ch.send(`<@${member.id}>`)
      setTimeout(() => msg.delete().catch(() => {}), 3000)
    }
  } catch (e) {
    console.error("MemberAdd error:", e.message)
  }
})

/* ================= GUARD ================= */

process.on("unhandledRejection", e =>
  console.error("UnhandledRejection:", e)
)

process.on("uncaughtException", e =>
  console.error("UncaughtException:", e)
)

/* ================= LOGIN ================= */

client.login(process.env.TOKEN)
