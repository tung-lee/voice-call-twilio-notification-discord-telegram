import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import type { NewMessageEvent } from 'telegram/events/NewMessage.js';
import { env } from '../config/index.js';
import { logger } from '../utils/index.js';
import { makeCall } from './voiceService.js';

// EVM: 0x + 40 hex chars
const EVM_REGEX = /\b0x[a-fA-F0-9]{40}\b/g;
// Solana: base58, 43-44 chars (excludes common English words via length floor)
const SOLANA_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{43,44}\b/g;

function extractTokenAddresses(text: string): string[] {
  const evm = text.match(EVM_REGEX) ?? [];
  const solana = text.match(SOLANA_REGEX) ?? [];
  return [...new Set([...evm, ...solana])];
}

class TelegramCooldown {
  private lastCallTime = 0;

  isInCooldown(): boolean {
    return Date.now() - this.lastCallTime < env.TELEGRAM_COOLDOWN_MS;
  }

  getRemainingSeconds(): number {
    return Math.ceil((env.TELEGRAM_COOLDOWN_MS - (Date.now() - this.lastCallTime)) / 1000);
  }

  reset(): void {
    this.lastCallTime = Date.now();
  }
}

const cooldown = new TelegramCooldown();
let client: TelegramClient | null = null;

async function handleMessage(event: NewMessageEvent): Promise<void> {
  const message = event.message;
  const text = message.text ?? message.message ?? '';

  if (!text) return;

  const addresses = extractTokenAddresses(text);
  if (addresses.length === 0) return;

  logger.info({ addresses }, 'Token address(es) detected in Telegram');

  if (cooldown.isInCooldown()) {
    logger.debug(
      { remaining: cooldown.getRemainingSeconds() },
      'Token detected — call skipped (cooldown)'
    );
    return;
  }

  cooldown.reset();

  const result = await makeCall({
    to: env.CALL_TO_NUMBER!,
    message: 'New token address detected in your Telegram channel.',
  });

  if (!result.success) {
    logger.error({ error: result.error }, 'Telegram-triggered call failed');
  }
}

export async function startTelegramTracker(): Promise<void> {
  const { TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION, TELEGRAM_CHANNEL_ID } = env;

  if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH || !TELEGRAM_SESSION) {
    logger.warn('Telegram tracker disabled — TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION not set');
    return;
  }

  client = new TelegramClient(
    new StringSession(TELEGRAM_SESSION),
    TELEGRAM_API_ID,
    TELEGRAM_API_HASH,
    { connectionRetries: 5 }
  );

  await client.connect();
  logger.info('Telegram client connected');

  const eventFilter = TELEGRAM_CHANNEL_ID
    ? new NewMessage({ chats: [TELEGRAM_CHANNEL_ID] })
    : new NewMessage({});

  client.addEventHandler(handleMessage, eventFilter);

  logger.info(
    { channel: TELEGRAM_CHANNEL_ID ?? 'all' },
    'Telegram tracker listening for token addresses'
  );
}

export async function stopTelegramTracker(): Promise<void> {
  if (client) {
    await client.disconnect();
    logger.info('Telegram client disconnected');
  }
}
