require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  SlashCommandBuilder,
  PermissionsBitField
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection
} = require("@discordjs/voice");

/* ================== CLIENT ================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.GuildMember]
});

/* ================== AYARLAR ================== */
const GUILD_ID = process.env.GUILD_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;

/* ================== SES ================== */
function connectVoice(guild) {
  const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
  if (!channel) return;

  joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,   // kulaklık kapalı
    selfMute: false   // mikrofon açık (boş)
  });

  console.log("🔊 Ses kanalına bağlandı");
}

/* ================== READY ================== */
client.once("ready", async () => {
  console.log(`🟢 Aktif: ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);

  /* BOT DURUM */
  client.user.setPresence({
    activities: [
      {
        name: "San Andreas State Police",
        type: ActivityType.Playing
      }
    ],
    status: "online"
  });

  /* SLASH KOMUTLAR */
  const commands = [
    new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Bot gecikmesini gösterir"),

    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kullanıcıyı atar")
      .addUserOption(o =>
        o.setName("kullanıcı")
          .setDescription("Atılacak kişi")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Kullanıcıyı yasaklar")
      .addUserOption(o =>
        o.setName("kullanıcı")
          .setDescription("Banlanacak kişi")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("Susturma verir")
      .addUserOption(o =>
        o.setName("kullanıcı")
          .setDescription("Susturulacak kişi")
          .setRequired(true)
      )
      .addIntegerOption(o =>
        o.setName("süre")
          .setDescription("Dakika")
          .setRequired(true)
      )
  ];

  await guild.commands.set(commands);
  console.log("✅ Slash komutlar temiz yüklendi");

  /* SES BAĞLAN */
  connectVoice(guild);
});

/* ================== KOMUTLAR ================== */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const member = interaction.member;

  if (interaction.commandName === "ping") {
    return interaction.reply(`🏓 Ping: ${client.ws.ping}ms`);
  }

  if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: "❌ Yetkin yok", ephemeral: true });
  }

  const user = interaction.options.getUser("kullanıcı");

  if (interaction.commandName === "kick") {
    await interaction.guild.members.kick(user.id);
    return interaction.reply(`👢 ${user.tag} atıldı`);
  }

  if (interaction.commandName === "ban") {
    await interaction.guild.members.ban(user.id);
    return interaction.reply(`⛔ ${user.tag} banlandı`);
  }

  if (interaction.commandName === "timeout") {
    const süre = interaction.options.getInteger("süre");
    const target = await interaction.guild.members.fetch(user.id);

    await target.timeout(süre * 60 * 1000);
    return interaction.reply(`🔇 ${user.tag} ${süre} dk susturuldu`);
  }
});

/* ================== SESTEN ATILIRSA ================== */
client.on("voiceStateUpdate", (oldState, newState) => {
  if (
    oldState.member.id === client.user.id &&
    oldState.channelId &&
    !newState.channelId
  ) {
    const guild = oldState.guild;
    setTimeout(() => connectVoice(guild), 3000);
  }
});

/* ================== LOGIN ================== */
client.login(process.env.TOKEN);
