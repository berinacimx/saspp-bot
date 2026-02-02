// =====================================
//  PUBLIC DISCORD BOT
//  Railway + Uptime + 24/7 Voice
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
//  SLASH COMMANDS
// =====================================
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Bot gecikmesini gösterir"),

  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Botu bulunduğun ses kanalına sokar"),

  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Botu ses kanalından çıkarır"),

  new SlashCommandBuilder()
    .setName("247")
    .setDescription("Botu 7/24 ses kanalında tutar"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Public duyuru")
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
//  BOT READY
// =====================================
client.once("ready", () => {
  console.log(`🟢 Bot aktif: ${client.user.tag}`)
})

// =====================================
//  INTERACTIONS
// =====================================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return

  // /ping
  if (interaction.commandName === "ping") {
    return interaction.reply(`🏓 Pong! ${client.ws.ping}ms`)
  }

  // /join
  if (interaction.commandName === "join") {
    const channel = interaction.member.voice.channel
    if (!channel)
      return interaction.reply({ content: "❌ Ses kanalında değilsin.", ephemeral: true })

    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator
    })

    return interaction.reply("🔊 Ses kanalına girdim.")
  }

  // /leave
  if (interaction.commandName === "leave") {
    const connection = getVoiceConnection(interaction.guild.id)
    if (!connection)
      return interaction.reply("❌ Zaten ses kanalında değilim.")

    connection.destroy()
    return interaction.reply("👋 Ses kanalından çıktım.")
  }

  // /247
  if (interaction.commandName === "247") {
    const channel = interaction.member.voice.channel
    if (!channel)
      return interaction.reply({ content: "❌ Ses kanalına gir.", ephemeral: true })

    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true
    })

    return interaction.reply("♾️ 7/24 ses moduna geçtim.")
  }

  // /announce
  if (interaction.commandName === "announce") {
    const mesaj = interaction.options.getString("mesaj")
    return interaction.reply(`📢 **DUYURU**\n\n${mesaj}`)
  }
})

// =====================================
//  START
// =====================================
registerCommands()
client.login(process.env.TOKEN)
