import { Client, GatewayIntentBits } from 'discord.js';
import { env } from '../config/index.js';
import { logger } from '../utils/index.js';
import { makeCall } from './voiceService.js';
import { sendSipMessage } from './sipCallService.js';

class CallCooldown {
  private lastCallTime = 0;

  isInCooldown(): boolean {
    const now = Date.now();
    return now - this.lastCallTime < env.DISCORD_COOLDOWN_MS;
  }

  getRemainingSeconds(): number {
    const now = Date.now();
    return Math.ceil((env.DISCORD_COOLDOWN_MS - (now - this.lastCallTime)) / 1000);
  }

  reset(): void {
    this.lastCallTime = Date.now();
  }
}

const cooldown = new CallCooldown();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('clientReady', () => {
  logger.info({ tag: client.user?.tag }, 'Discord bot connected');
});

client.on('messageCreate', async (message) => {
  if (env.DISCORD_CHANNEL_ID && message.channelId !== env.DISCORD_CHANNEL_ID) return;

  if (cooldown.isInCooldown()) {
    logger.debug(
      { remaining: cooldown.getRemainingSeconds() },
      'Discord message received — call skipped (cooldown)'
    );
    return;
  }

  cooldown.reset();
  logger.info(
    { channel: message.channelId, author: message.author.tag },
    'Discord message — triggering call'
  );

  const preview = message.content.slice(0, 200);
  const [, callResult] = await Promise.all([
    sendSipMessage(`[Discord] ${message.author.tag}: ${preview}`),
    makeCall({ to: env.CALL_TO_NUMBER, message: 'You have a new message in Discord.' }),
  ]);

  if (!callResult.success) {
    logger.error({ error: callResult.error }, 'Discord-triggered call failed');
  }
});

export function startDiscordBot(): void {
  client.login(env.DISCORD_BOT_TOKEN).catch((err) => {
    logger.error({ err }, 'Failed to connect Discord bot');
  });
}

export function stopDiscordBot(): void {
  client.destroy();
  logger.info('Discord bot disconnected');
}
