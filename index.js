// =====================================
//  PUBLIC DISCORD BOT
//  24/7 VOICE + AUTO JOIN + AUTH
// =====================================

import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Routes
} from "discord.js"

import { REST } from "@discordjs/rest"
import {
  joinVoiceChannel,
  getVoiceConnection
} from "@discordjs/voice"

import express from "express"
import dotenv from "dotenv"

dotenv.config()

// =====================================
//  UPTIME SERVER
// =====================================
const app = express()
const PORT = process.env.PORT || 3000

app.get("/", (req, res) => {
  res.json({
    status: "online",
    bot: "Public Discord Bot",
    uptime: process.uptime()
  })
})

app.listen(PORT, () => {
  console.log(`🌐 Uptime aktif | Port ${PORT}`)
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
//  SLASH COMMANDS
// =====================================
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Bot gecikmesini gösterir"),

  new SlashCommandBuilder()
    .setName("247")
    .setDescription("Botu 7/24 ses kanalına sokar (yetkili)"),

  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Botu ses kanalından çıkarır (yetkili)"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Yetkili duyuru")
    .addStringOption(opt =>
      opt.setName("mesaj")
        .setDescription("Duyuru mesajı")
        .setRequired(true)
    )
].map(c => c.toJSON())

// =====================================
//  COMMAND REGISTER
// =====================================
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

async function registerCommands() {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  )
  console.log("✅ Slash komutlar yüklendi")
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
    selfDeaf: true
  })

  console.log("♾️ Otomatik ses kanalına girildi")
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
    console.log("⚠️ Bot sesten düştü, tekrar giriliyor...")
    setTimeout(joinAutoVoice, 3000)
  }
})

// =====================================
//  INTERACTIONS
// =====================================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return

  const member = interaction.member

  // /ping
  if (interaction.commandName === "ping") {
    return interaction.reply(`🏓 Pong! ${client.ws.ping}ms`)
  }

  // Yetkili kontrol
  if (!isAuthorized(member)) {
    return interaction.reply({
      content: "❌ Bu komutu kullanmak için yetkin yok.",
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

  // /announce
  if (interaction.commandName === "announce") {
    const mesaj = interaction.options.getString("mesaj")
    return interaction.reply(`📢 **YETKİLİ DUYURU**\n\n${mesaj}`)
  }
})

// =====================================
//  START
// =====================================
registerCommands()
client.login(process.env.TOKEN)
