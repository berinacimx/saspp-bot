/* ================= ENV & FIX ================= */
process.env.DISCORDJS_VOICE_FORCE_AES256 = "true"
require("dotenv").config()

/* ================= IMPORTS ================= */
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
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
})

/* ================= UPTIME ================= */
http.createServer((req, res) => {
  res.end("OK")
}).listen(process.env.PORT || 3000)

/* ================= VOICE ================= */
let reconnecting = false

async function connectVoice() {
  if (reconnecting) return
  reconnecting = true

  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID)
    const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID)

    if (!channel || !channel.isVoiceBased()) {
      console.log("❌ Ses kanalı yok")
      reconnecting = false
      return
    }

    const existing = getVoiceConnection(guild.id)
    if (existing) {
      reconnecting = false
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
    console.log("🔊 Ses kanalına girildi")

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
        }, 5000)
      }
    })

  } catch (err) {
    console.error("Ses hatası:", err.message)
    setTimeout(() => {
      reconnecting = false
      connectVoice()
    }, 7000)
  }
}

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`🟢 Aktif: ${client.user.tag}`)

  await connectVoice()

  /* Presence — RATE LIMIT SAFE */
  client.user.setPresence({
    activities: [
      { name: "San Andreas State Police #DESTAN", type: ActivityType.Playing }
    ],
    status: "online"
  })
})

/* ================= ATILIRSA ================= */
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (oldState.member?.id !== client.user.id) return
  if (oldState.channelId && !newState.channelId) {
    console.log("❌ Sesten atıldı")
    setTimeout(connectVoice, 3000)
  }
})

/* ================= SAFETY ================= */
process.on("unhandledRejection", err => {
  console.error("Unhandled:", err.message)
})

process.on("uncaughtException", err => {
  console.error("Crash:", err.message)
})

/* ================= LOGIN ================= */
client.login(process.env.TOKEN)
