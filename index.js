const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionsBitField,
  Events,
  ActivityType
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus
} = require("@discordjs/voice");

const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* ========= AYARLAR ========= */
const GUILD_ID = "SUNUCU_ID";
const VOICE_CHANNEL_ID = "SES_KANAL_ID";
const YETKILI_ROLE_ID = "YETKILI_ROLE_ID";
/* ========================== */

const SICIL_FILE = "./sicil.json";

/* 🔊 SES BAĞLANTISI */
function connectVoice() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
  if (!channel) return;

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    console.log("⚠️ Ses düştü → yeniden bağlanıyor");
    setTimeout(connectVoice, 3000);
  });
}

/* 🟢 READY */
client.once(Events.ClientReady, async () => {
  console.log("🟢 Bot aktif");

  connectVoice();

  /* Slash kayıt */
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
  ];

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.commands.set(commands);
});

/* 🔁 ATILIRSA GERİ GİR */
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (oldState.member?.id !== client.user.id) return;
  if (oldState.channelId && !newState.channelId) {
    console.log("⚠️ Sesten atıldı → geri giriliyor");
    setTimeout(connectVoice, 2000);
  }
});

/* 🧾 SICIL YARDIMCI */
function readSicil() {
  return JSON.parse(fs.readFileSync(SICIL_FILE));
}
function writeSicil(data) {
  fs.writeFileSync(SICIL_FILE, JSON.stringify(data, null, 2));
}

/* ⚙️ SLASH KOMUTLAR */
client.on(Events.InteractionCreate, async i => {
  if (!i.isChatInputCommand()) return;

  const member = i.member;
  if (!member.roles.cache.has(YETKILI_ROLE_ID))
    return i.reply({ content: "❌ Yetkin yok", ephemeral: true });

  const sicil = readSicil();

  /* SICIL */
  if (i.commandName === "sicil") {
    const user = i.options.getUser("kullanıcı");

    if (i.options.getSubcommand() === "ekle") {
      const sebep = i.options.getString("sebep");
      sicil[user.id] ??= [];
      sicil[user.id].push(sebep);
      writeSicil(sicil);
      return i.reply(`✅ ${user.tag} siciline eklendi`);
    }

    if (i.options.getSubcommand() === "sil") {
      delete sicil[user.id];
      writeSicil(sicil);
      return i.reply(`🗑️ ${user.tag} sicili silindi`);
    }

    if (i.options.getSubcommand() === "görüntüle") {
      const list = sicil[user.id]?.join("\n• ") || "Kayıt yok";
      return i.reply(`📄 **${user.tag} Sicil**\n• ${list}`);
    }
  }

  /* BAN */
  if (i.commandName === "ban") {
    const user = i.options.getUser("kullanıcı");
    const sebep = i.options.getString("sebep") || "Sebep yok";
    await i.guild.members.ban(user.id, { reason: sebep });
    return i.reply(`⛔ ${user.tag} banlandı`);
  }

  /* KICK */
  if (i.commandName === "kick") {
    const user = i.options.getUser("kullanıcı");
    const sebep = i.options.getString("sebep") || "Sebep yok";
    await i.guild.members.kick(user.id, sebep);
    return i.reply(`👢 ${user.tag} kicklendi`);
  }

  /* TIMEOUT */
  if (i.commandName === "timeout") {
    const user = i.options.getUser("kullanıcı");
    const dakika = i.options.getInteger("dakika");
    const sebep = i.options.getString("sebep") || "Sebep yok";

    const m = await i.guild.members.fetch(user.id);
    await m.timeout(dakika * 60 * 1000, sebep);
    return i.reply(`⏱️ ${user.tag} ${dakika} dk timeout`);
  }
});

client.login(process.env.TOKEN);
