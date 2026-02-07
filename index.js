require("dotenv").config()

const {
  Client,
  GatewayIntentBits,
  Events
} = require("discord.js")

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice")

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
})

/* ================= VOICE MANAGER ================= */

let voiceConnection = null
let reconnectTimeout = null

async function connectToVoice() {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID)
    const channel = await guild.channels.fetch(process.env.VOICE_CHANNEL_ID)

    if (!channel || channel.type !== 2) {
      console.log("❌ Ses kanalı bulunamadı veya geçersiz")
      return
    }

    voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false
    })

    console.log("🔊 Bot sese bağlandı")

    voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log("⚠️ Ses bağlantısı koptu, tekrar bağlanılıyor...")

      try {
        await Promise.race([
          entersState(voiceConnection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5_000)
        ])
      } catch {
        reconnectVoice()
      }
    })

    voiceConnection.on("error", err => {
      console.error("🔴 Ses hatası:", err.message)
      reconnectVoice()
    })

  } catch (err) {
    console.error("🔴 Ses bağlantı hatası:", err.message)
    reconnectVoice()
  }
}

function reconnectVoice() {
  if (reconnectTimeout) return

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null
    connectToVoice()
  }, 10_000)
}

/* ================= READY ================= */

client.once(Events.ClientReady, () => {
  console.log(`🟢 Aktif: ${client.user.tag}`)
  console.log("✅ Slash komutlar yüklendi")

  connectToVoice()

  // Presence rate-limit yemesin diye 60 sn
  setInterval(() => {
    client.user.setPresence({
      activities: [{ name: "San Andreas State Police", type: 3 }],
      status: "online"
    })
  }, 60_000)
})

/* ================= GUILD MEMBER ADD ================= */

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
    console.error("Üye giriş hatası:", err.message)
  }
})

/* ================= ERROR GUARD ================= */

process.on("unhandledRejection", err => {
  console.error("⚠️ Unhandled Rejection:", err.message)
})

process.on("uncaughtException", err => {
  console.error("🔥 Uncaught Exception:", err.message)
})

/* ================= LOGIN ================= */

client.login(process.env.TOKEN)
