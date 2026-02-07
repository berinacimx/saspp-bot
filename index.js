require("dotenv").config()

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionsBitField,
  Events,
  ActivityType
} = require("discord.js")

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus
} = require("@discordjs/voice")

const fs = require("fs")
const path = require("path")

/* ========= SABİTLER ========= */
const {
  TOKEN,
  GUILD_ID,
  VOICE_CHANNEL_ID,
  YETKILI_ROLE_ID
} = process.env

const SICIL_FILE = path.join(__dirname, "sicil.json")

/* ========= CLIENT ========= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
})

/* ========= SICIL DOSYA ========= */
if (!fs.existsSync(SICIL_FILE)) {
  fs.writeFileSync(SICIL_FILE, JSON.stringify({}, null, 2))
}

const readSicil = () =>
  JSON.parse(fs.readFileSync(SICIL_FILE, "utf8"))

const writeSicil = data =>
  fs.writeFileSync(SICIL_FILE, JSON.stringify(data, null, 2))

/* ========= SES BAĞLANTISI ========= */
function connectVoice() {
  try {
    const guild = client.guilds.cache.get(GUILD_ID)
    if (!guild) return

    const channel = guild.channels.cache.get(VOICE_CHANNEL_ID)
    if (!channel?.isVoiceBased()) return

    const existing = getVoiceConnection(guild.id)
    if (existing) return

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true
    })

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log("🔁 Ses koptu → yeniden bağlanıyor")
      setTimeout(connectVoice, 3000)
    })
  } catch (err) {
    console.error("❌ Voice error:", err.message)
  }
}

/* ========= READY ========= */
client.once(Events.ClientReady, async () => {
  console.log(`🟢 Aktif: ${client.user.tag}`)

  client.user.setActivity("Sunucuyu izliyor 👀", {
    type: ActivityType.Watching
  })

  connectVoice()

  const commands = [
    new SlashCommandBuilder()
      .setName("sicil")
      .setDescription("Sicil işlemleri")
      .addSubcommand(s =>
        s.setName("ekle")
          .setDescription("Sicil ekle")
          .addUserOption(o => o.setName("kullanıcı").setRequired(true))
          .addStringOption(o => o.setName("sebep").setRequired(true))
      )
      .addSubcommand(s =>
        s.setName("sil")
          .setDescription("Sicil sil")
          .addUserOption(o => o.setName("kullanıcı").setRequired(true))
      )
      .addSubcommand(s =>
        s.setName("görüntüle")
          .setDescription("Sicil görüntüle")
          .addUserOption(o => o.setName("kullanıcı").setRequired(true))
      ),

    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban at")
      .addUserOption(o => o.setName("kullanıcı").setRequired(true))
      .addStringOption(o => o.setName("sebep")),

    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kick at")
      .addUserOption(o => o.setName("kullanıcı").setRequired(true))
      .addStringOption(o => o.setName("sebep")),

    new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("Timeout at")
      .addUserOption(o => o.setName("kullanıcı").setRequired(true))
      .addIntegerOption(o => o.setName("dakika").setRequired(true))
      .addStringOption(o => o.setName("sebep"))
  ]

  const guild = await client.guilds.fetch(GUILD_ID)
  await guild.commands.set(commands)

  console.log("✅ Slash komutlar yüklendi")
})

/* ========= SİCİL + MOD ========= */
client.on(Events.InteractionCreate, async i => {
  if (!i.isChatInputCommand()) return

  const member = i.member
  if (!member.roles.cache.has(YETKILI_ROLE_ID))
    return i.reply({ content: "❌ Yetkin yok", ephemeral: true })

  const sicil = readSicil()

  try {
    if (i.commandName === "sicil") {
      const user = i.options.getUser("kullanıcı")

      if (i.options.getSubcommand() === "ekle") {
        const sebep = i.options.getString("sebep")
        sicil[user.id] ??= []
        sicil[user.id].push(sebep)
        writeSicil(sicil)
        return i.reply(`✅ ${user.tag} siciline eklendi`)
      }

      if (i.options.getSubcommand() === "sil") {
        delete sicil[user.id]
        writeSicil(sicil)
        return i.reply(`🗑️ ${user.tag} sicili silindi`)
      }

      if (i.options.getSubcommand() === "görüntüle") {
        const list = sicil[user.id]?.join("\n• ") || "Kayıt yok"
        return i.reply(`📄 **${user.tag} Sicil**\n• ${list}`)
      }
    }

    if (i.commandName === "ban") {
      const user = i.options.getUser("kullanıcı")
      await i.guild.members.ban(user.id)
      return i.reply(`⛔ ${user.tag} banlandı`)
    }

    if (i.commandName === "kick") {
      const user = i.options.getUser("kullanıcı")
      await i.guild.members.kick(user.id)
      return i.reply(`👢 ${user.tag} kicklendi`)
    }

    if (i.commandName === "timeout") {
      const user = i.options.getUser("kullanıcı")
      const dakika = i.options.getInteger("dakika")
      const m = await i.guild.members.fetch(user.id)
      await m.timeout(dakika * 60 * 1000)
      return i.reply(`⏱️ ${user.tag} ${dakika} dk timeout`)
    }
  } catch (err) {
    console.error(err)
    return i.reply({ content: "❌ Bir hata oluştu", ephemeral: true })
  }
})

/* ========= SES ATILIRSA ========= */
client.on(Events.VoiceStateUpdate, (o, n) => {
  if (o.member?.id === client.user.id && o.channelId && !n.channelId) {
    console.log("⚠️ Sesten atıldı → geri giriyor")
    setTimeout(connectVoice, 2000)
  }
})

client.login(TOKEN)
