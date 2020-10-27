require('dotenv').config();
const { Client, MessageEmbed } = require('discord.js');
const db = require('./models');

// Configuration.
const { prefix, token } = require('./config/app');
const RULES_MESSAGE_ID = require('./config/rulesMessageId');

// Constants.
const {
  APPLICATION_CONSTANTS, MESSAGES_CONSTANTS,
} = require('./constants');

// Helpers.
const { MAIN_HELPER, LOGGER } = require('./helpers');

// Commands.
const commands = require('./commands');

// User wallets collection.
const { WALLETS } = require('./helpers');

// Destruct constants.
const {
  READY_MESSAGE,
  COMMAND_ERROR_MESSAGE,
} = APPLICATION_CONSTANTS;
const {
  UNKNOWN_COMMAND_ERROR_MESSAGE, DB_SYNC_ERROR_MESSAGE,
  WELCOME_TITLE, WELCOME_MESSAGE,
} = MESSAGES_CONSTANTS;

// Create the client.
const client = new Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });

client.commands = commands;

client.once('ready', () => {
  db.sequelize.sync({})
    .then(async () => {
      const allUsers = await db.User.findAll();
      allUsers.forEach(user => WALLETS.set(user.id, user));

      LOGGER.log('info', READY_MESSAGE);
    }).catch(error => {
      LOGGER.log('error', `${DB_SYNC_ERROR_MESSAGE} - ${error}`);
    });
});

client.on('guildMemberAdd', async member => {
  const { guild, user } = member;
  const rulesChannel = guild.channels.cache.find(channel => channel.name === 'rules');

  const messageEmbed = new MessageEmbed()
    .setTitle(WELCOME_TITLE.replace('%server%', rulesChannel.guild.name))
    .setDescription(
      WELCOME_MESSAGE
        .replace('%user%', user)
        .replace('%channel%', rulesChannel),
    );

  user.send(messageEmbed);
});

client.on('message', message => {
  const { author, channel, content } = message;
  if (!content.startsWith(prefix) || author.bot) return;

  // Delete the command message.
  if (channel.type !== 'dm') {
    channel.messages.delete(message);
  }

  // Get the command and its arguments.
  const args = content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = MAIN_HELPER.getCommand(client.commands, commandName);

  // Error if there's no command for the command name.
  if (!command) {
    const errorMessage = UNKNOWN_COMMAND_ERROR_MESSAGE
      .replace('%prefix%', prefix)
      .replace('%command%', commandName);

    message.reply(errorMessage);
    return;
  }

  // Error if not enough required arguments.
  const isEnoughArgs = MAIN_HELPER
    .handleArgsCount(message, command, args.length);

  if (!isEnoughArgs) return;

  // Error if cooldown period.
  const { name, cooldown } = command;
  const isCooldown = MAIN_HELPER
    .handleCooldowns(message, name, cooldown);

  if (isCooldown) return;

  try {
    command.execute(message, args);
  } catch (error) {
    let response = COMMAND_ERROR_MESSAGE;

    if (error) {
      response += `\n\`[ERROR] - ${error}\``;
    }

    LOGGER.log('error', `${COMMAND_ERROR_MESSAGE} - ${error}`);

    message.reply(response);
  }
});

client.on('messageReactionAdd', (reaction, user) => {
  const { id, guild } = reaction.message;
  const { messageId } = RULES_MESSAGE_ID;

  // If it's the rules message
  if (id === messageId) {
    const memberRole = guild.roles.cache.find(role => role.name === 'Member');

    guild.members.fetch(user.id).then(member => {
      member.roles.add(memberRole);
      // Create user in db.
      // Give user money.
      // Notify user.
      const messageEmbed = new MessageEmbed()
        .setColor('BLUE')
        .setTitle('Thank you!')
        .setDescription('Thank you for reading the rules.\nYou now have the `Member` role and can participate in other channels.\nYou received a $200 bonus.');

      user.send(messageEmbed);
    });
  }
});

client.login(token);
