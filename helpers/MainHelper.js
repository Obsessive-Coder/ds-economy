const { Collection } = require('discord.js');

// Config.
const { prefix } = require('../config/app');

// Constants.
const { USER_MENTION_REGEX } = require('../constants/regex');
const {
  COOLDOWN_MESSAGE,
  INVALID_ARGUMENT_ERROR_MESSAGE,
  USAGE_ERROR_MESSAGE,
} = require('../constants/messages');

module.exports = class MainHelper {
  static getCommand(commands, name) {
    let command = commands.get(name);

    if (!command) {
      command = commands.find(({ aliases }) => (
        aliases && aliases.includes(name)
      ));
    }

    return command;
  }

  static getUserFromMention(mention, client) {
    const matches = mention.match(USER_MENTION_REGEX);

    if (!matches) return false;

    const userId = matches[1];

    return client.users.cache.get(userId);
  }

  static handleCooldowns(message, cooldowns, name, cooldown) {
    if (!cooldowns.has(name)) {
      cooldowns.set(name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(name);
    const cooldownAmount = (cooldown || 3) * 1000;
    const { author: { id: authorId } } = message;

    if (timestamps.has(authorId)) {
      const expirationTime = timestamps.get(authorId) + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        message.reply(
          COOLDOWN_MESSAGE.replace('%timeLeft%', timeLeft).replace('%name%', name),
        );

        return true;
      }

      return false;
    }

    timestamps.set(authorId, now);
    setTimeout(() => timestamps.delete(authorId), cooldownAmount);
    return false;
  }

  static handleArgsCount(message, command, argsLength) {
    const {
      name, isArgsRequired, requiredArgsCount, usage,
    } = command;

    if (isArgsRequired && argsLength < requiredArgsCount) {
      let reply = `${INVALID_ARGUMENT_ERROR_MESSAGE}, ${message.author}!`;

      if (command.usage) {
        reply += `\n${USAGE_ERROR_MESSAGE} \`${prefix}${name} ${usage}\``;
      }

      message.channel.send(reply);

      return false;
    }
    return true;
  }
};
