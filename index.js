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

let reconnecting = false

/* ================= UPTIME ================= */

http.createServer((_, res) => {
  res.writeHead(200)
  res.end("OK")
}).listen(process.env.PORT || 3000)

/* ================= VOICE ================= */

async function connectVoice() {
  if (reconnecting) return
  reconnecting = true

  try {
    console.log("🎧 Ses bağlantısı deneniyor...")

    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null)
    if (!guild) throw new Error("Guild bulunamadı")

    const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID)
    if (!channel || !channel.isVoiceBased())
      throw new Error("Ses kanalı geçersiz")

    if (getVoiceConnection(guild.id)) {
      console.log("ℹ️ Zaten sese bağlı")
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
    console.log("🔊 Bot sese başarıyla bağlandı")

    reconnecting = false

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log("⚠️ Ses bağlantısı koptu")

      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
        ])
      } catch {
        console.log("🔁 Yeniden bağlanılıyor...")
        setTimeout(() => {
          reconnecting = false
          connectVoice()
        }, 8000)
      }
    })

  } catch (err) {
    console.error("🔴 Ses hatası:", err.message)
    reconnecting = false
    setTimeout(connectVoice, 12_000)
  }
}

/* ================= READY ================= */

client.once(Events.ClientReady, async () => {
  console.log(`🟢 Bot aktif: ${client.user.tag}`)

  setTimeout(connectVoice, 5000)

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
    /* OTOROL */
    const role = member.guild.roles.cache.get(process.env.OTOROL_ID)
    if (role) await member.roles.add(role).catch(() => {})

    /* HOŞGELDİN */
    const welcome = member.guild.channels.cache.get(process.env.HOSGELDIN_KANAL_ID)
    if (welcome) {
      await welcome.send(
        `<@${member.id}> Sunucumuza hoş geldin 👋\n` +
        `Başvuru ve bilgilendirme kanallarını incelemeyi unutma.\n\n` +
        `San Andreas State Police #𝐃𝐄𝐒𝐓𝐀𝐍`
      )
    }

    /* ETİKET */
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

process.on("unhandledRejection", err =>
  console.error("UnhandledRejection:", err)
)

process.on("uncaughtException", err =>
  console.error("UncaughtException:", err)
)

/* ================= LOGIN ================= */

client.login(process.env.TOKEN)
