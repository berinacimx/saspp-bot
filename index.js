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
http.createServer((_, res) => {
  res.writeHead(200)
  res.end("OK")
}).listen(process.env.PORT || 3000)

/* ================= SES KONTROL ================= */
let reconnecting = false

async function connectVoice(force = false) {
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID)
    if (!guild) return console.log("❌ Guild bulunamadı")

    const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID)
    if (!channel || !channel.isVoiceBased())
      return console.log("❌ Ses kanalı geçersiz")

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

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000)
    console.log("🔊 Ses kanalına bağlanıldı")

    connection.on(VoiceConnectionStatus.Disconnected, () => retryVoice())
    connection.on(VoiceConnectionStatus.Destroyed, () => retryVoice())
    connection.on(VoiceConnectionStatus.Signalling, () => retryVoice())

  } catch (err) {
    console.error("❌ Ses bağlantı hatası:", err)
    retryVoice()
  }
}

function retryVoice() {
  if (reconnecting) return
  reconnecting = true

  console.log("⚠️ Ses düştü → yeniden bağlanılıyor")

  setTimeout(async () => {
    reconnecting = false
    await connectVoice(true)
  }, 5000)
}

/* ================= READY ================= */
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

      client.user.setPresence({ activities: [activity], status: "online" })
      mode = (mode + 1) % 2
    } catch {}
  }, 15_000)
})

/* ================= ÜYE GİRİNCE ================= */
client.on(Events.GuildMemberAdd, async member => {
  try {
    const ch = member.guild.channels.cache.get(process.env.HOSGELDIN_KANAL_ID)
    if (ch) {
      await ch.send(
        `<@${member.id}> Sunucumuza hoş geldin 👋\n` +
        `Başvuru için <#${process.env.BASVURU_KANAL_ID}> kanalını inceleyebilirsin.\n\n` +
        `**San Andreas State Police #𝐃𝐄𝐒𝐓𝐀𝐍**`
      )
    }

    for (const id of process.env.ETIKET_KANALLAR.split(",")) {
      const c = member.guild.channels.cache.get(id)
      if (!c) continue
      const msg = await c.send(`<@${member.id}>`)
      setTimeout(() => msg.delete().catch(() => {}), 3000)
    }
  } catch (e) {
    console.error("Üye giriş hatası:", e)
  }
})

/* ================= GÜVENLİK ================= */
process.on("unhandledRejection", console.error)
process.on("uncaughtException", console.error)
client.on("error", console.error)

/* ================= LOGIN ================= */
client.login(process.env.TOKEN)
