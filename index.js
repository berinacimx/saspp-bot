import { Client, GatewayIntentBits, Events } from "discord.js"
import { joinVoiceChannel, getVoiceConnection } from "@discordjs/voice"
import express from "express"
import dotenv from "dotenv"

dotenv.config()

// =====================================
// UPTIME SERVER
// =====================================
const app = express()
app.get("/", (_, res) => res.send("Bot online"))
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🌐 Uptime server aktif | ${PORT}`))

// =====================================
// DISCORD CLIENT
// =====================================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
})

// =====================================
// AUTH CHECK
// =====================================
function isAuthorized(member) {
  return member.roles.cache.has(process.env.AUTHORIZED_ROLE_ID)
}

// =====================================
// AUTO VOICE JOIN (Encryption Safe)
// =====================================
function joinAutoVoice() {
  const guild = client.guilds.cache.get(process.env.GUILD_ID)
  if (!guild) return

  const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID)
  if (!channel) return

  joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  })

  console.log("♾️ Ses kanalına bağlanıldı")
}

// =====================================
// BOT READY
// =====================================
client.once(Events.ClientReady, () => {
  console.log(`🟢 Bot aktif: ${client.user.tag}`)
  joinAutoVoice()
})

// =====================================
// RECONNECT IF DROPPED
// =====================================
client.on(Events.VoiceStateUpdate, (_, newState) => {
  if (newState.member?.id === client.user.id && !newState.channelId) {
    console.log("⚠️ Sesten düştü, tekrar bağlanıyor...")
    setTimeout(joinAutoVoice, 3000)
  }
})

// =====================================
// SLASH COMMANDS
// =====================================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return

  const member = interaction.member

  // /ping
  if (interaction.commandName === "ping") {
    return interaction.reply(`🏓 Pong! ${client.ws.ping}ms`)
  }

  // Yetkili kontrol
  if (!isAuthorized(member)) {
    return interaction.reply({
      content: "❌ Yetkin yok.",
      flags: 64 // EPHEMERAL
    })
  }

  // /247
  if (interaction.commandName === "247") {
    joinAutoVoice()
    return interaction.reply("♾️ 7/24 ses modu aktif.")
  }

  // /leave
  if (interaction.commandName === "leave") {
    const conn = getVoiceConnection(interaction.guild.id)
    if (conn) conn.destroy()
    return interaction.reply("👋 Ses kanalından çıktım.")
  }

  // /announce
  if (interaction.commandName === "announce") {
    const mesaj = interaction.options.getString("mesaj")
    return interaction.reply(`📢 DUYURU: ${mesaj}`)
  }
})

// =====================================
// CRASH PROTECTION
// =====================================
process.on("unhandledRejection", err => console.error("UNHANDLED:", err))
process.on("uncaughtException", err => console.error("UNCAUGHT:", err))

// =====================================
// LOGIN
// =====================================
client.login(process.env.TOKEN)
