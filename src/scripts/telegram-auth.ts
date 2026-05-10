import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import dotenv from 'dotenv';

dotenv.config();

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH ?? '';

if (!apiId || !apiHash) {
  console.error('Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first');
  process.exit(1);
}

const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: async () => input.text('Phone number (with country code, e.g. +84...): '),
  password: async () => input.text('2FA password (leave blank if none): '),
  phoneCode: async () => input.text('OTP code from Telegram: '),
  onError: (err) => console.error(err),
});

console.log('\n✅ Auth successful! Copy this session string into your .env:\n');
console.log(`TELEGRAM_SESSION=${client.session.save()}`);
console.log();

await client.disconnect();
