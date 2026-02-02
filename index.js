// =====================================
//  STABLE PUBLIC DISCORD BOT
//  Railway + 24/7 Voice + Auth
// =====================================

import { Client, GatewayIntentBits } from "discord.js"
import { joinVoiceChannel, getVoiceConnection } from "@discordjs/voice"
import express from "express"
import dotenv from "dotenv"

dotenv.config()

// =====================================
//  UPTIME SERVER
// =====================================
const app = express()
const PORT = process.env.PORT || 3000

app.get("/", (req, res) => {
  res.send("Bot online")
})

app.listen(PORT, () => {
  console.log(`🌐 Uptime server aktif | ${PORT}`)
})

// =====================================
//  DISCORD CLIENT
// =====================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
})

// =====================================
//  AUTH CHECK
// =====================================
function isAuthorized(member) {
  return member.roles.cache.has(process.env.AUTHORIZED_ROLE_ID)
}

// =====================================
//  AUTO VOICE JOIN
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
//  BOT READY
// =====================================
client.once("ready", () => {
  console.log(`🟢 Bot aktif: ${client.user.tag}`)
  joinAutoVoice()
})

// =====================================
//  RECONNECT IF DROPPED
// =====================================
client.on("voiceStateUpdate", (_, newState) => {
  if (
    newState.member?.id === client.user.id &&
    !newState.channelId
  ) {
    console.log("⚠️ Sesten düştü, tekrar giriliyor...")
    setTimeout(joinAutoVoice, 3000)
  }
})

// =====================================
//  SLASH COMMAND HANDLER
// =====================================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return

  const member = interaction.member

  // /ping
  if (interaction.commandName === "ping") {
    return interaction.reply(`🏓 Pong! ${client.ws.ping}ms`)
  }

  // yetkili kontrol
  if (!isAuthorized(member)) {
    return interaction.reply({
      content: "❌ Yetkin yok.",
      ephemeral: true
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
})

// =====================================
//  CRASH PROTECTION
// =====================================
process.on("unhandledRejection", err => {
  console.error("UNHANDLED:", err)
})

process.on("uncaughtException", err => {
  console.error("UNCAUGHT:", err)
})

// =====================================
//  LOGIN
// =====================================
client.login(process.env.TOKEN)
