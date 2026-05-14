# alpha-signal-reminder

Monitors Discord channels and Telegram chats for cryptocurrency token address signals and rings your iPhone immediately via a free SIP call or paid Twilio PSTN call.

---

## Features

- **Discord monitoring** — bot watches server channels and triggers a call on any new message
- **Telegram monitoring** — user account listener detects EVM and Solana token contract addresses in messages
- **SIP calling (free)** — sends a SIP INVITE to `sip.linphone.org`, which wakes the Linphone iOS app via Apple PushKit — no paid account needed
- **Twilio calling (paid)** — places a real PSTN call with a synthesized voice message
- **Per-source cooldown** — configurable quiet period per source (default 5 minutes) to prevent call spam
- **HTTP webhook** — `GET /webhook` triggers a call manually; useful for external integrations
- **PM2 ready** — single-instance process manager config with autorestart and 256MB memory cap

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — see [Environment Variables](#environment-variables) below for all options.

### 3. Telegram authentication (one-time, optional)

Skip this step if you are not using Telegram monitoring.

```bash
npm run telegram:auth
```

Follow the prompts: enter your phone number, then the OTP sent by Telegram. Copy the printed `TELEGRAM_SESSION` value into `.env`.

### 4. Run

```bash
# Development (hot reload)
npm run dev

# Production via PM2
npm run pm2:start
```

---

## Call Providers

Set `CALL_PROVIDER` in `.env` to choose how alerts ring your phone.

### SIP — free (recommended)

Rings the Linphone iOS app via Apple PushKit. No paid account, no per-minute cost.

```env
CALL_PROVIDER=sip
SIP_BOT_USER=alertbot            # any string — not a real account
SIP_BOT_DOMAIN=iptel.org         # any external domain — must NOT be sip.linphone.org
SIP_TARGET_USER=yourlinphoneuser # your Linphone username on sip.linphone.org
SIP_TARGET_DOMAIN=sip.linphone.org
SIP_RING_DURATION_MS=30000       # auto-hang-up after 30 seconds
```

**Setup:** Install Linphone on your iPhone, create a free `yourname@sip.linphone.org` account, and stay logged in. The app does not need to be open — PushKit wakes it in the background.

See [SIP_SETUP.md](./docs/SIP_SETUP.md) for the full explanation, the SIP federation trick that makes this work, and every error encountered during development.

### Twilio — paid

Places a real PSTN call using Twilio's REST API. Trial accounts can only call verified numbers.

```env
CALL_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1...
CALL_TO_NUMBER=+1...
```

| Provider | Cost | Notes |
|---|---|---|
| SIP | Free | Requires Linphone app on iPhone |
| Twilio | ~$0.013/min | Verified numbers only on trial accounts |

---

## Environment Variables

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `LOG_LEVEL` | `info` | `fatal` `error` `warn` `info` `debug` `trace` |

### Call routing

| Variable | Default | Description |
|---|---|---|
| `CALL_PROVIDER` | `sip` | `sip` or `twilio` |
| `CALL_TO_NUMBER` | required | Your number to receive calls (E.164 format: `+84...`) |

### Twilio

| Variable | Default | Description |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | required | Account SID from console.twilio.com |
| `TWILIO_AUTH_TOKEN` | required | Auth token from console.twilio.com |
| `TWILIO_PHONE_NUMBER` | required | Your Twilio number (E.164) |

### Discord

| Variable | Default | Description |
|---|---|---|
| `DISCORD_BOT_TOKEN` | required | Bot token from discord.com/developers |
| `DISCORD_COOLDOWN_MS` | `300000` | Min ms between calls (5 minutes) |
| `DISCORD_CHANNEL_ID` | optional | Restrict to one channel; blank = all channels |

### Telegram

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_API_ID` | optional | App ID from my.telegram.org |
| `TELEGRAM_API_HASH` | optional | App hash from my.telegram.org |
| `TELEGRAM_SESSION` | optional | Session string from `npm run telegram:auth` |
| `TELEGRAM_CHANNEL_ID` | optional | Restrict to one channel; blank = all channels |
| `TELEGRAM_COOLDOWN_MS` | `300000` | Min ms between calls (5 minutes) |

### SIP

| Variable | Default | Description |
|---|---|---|
| `SIP_BOT_USER` | `alertbot` | Caller username in SIP `From:` header |
| `SIP_BOT_DOMAIN` | `iptel.org` | Caller domain — must not be `sip.linphone.org` |
| `SIP_TARGET_USER` | `ericle` | Your Linphone username |
| `SIP_TARGET_DOMAIN` | `sip.linphone.org` | SIP registrar with PushKit support |
| `SIP_RING_DURATION_MS` | `30000` | Ring timeout before auto-hang-up (ms) |

---

## Discord Setup

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) and create a new application
2. Open the **Bot** tab and click **Add Bot**
3. Under **Privileged Gateway Intents**, enable **Message Content Intent**
4. Copy the bot token and set it as `DISCORD_BOT_TOKEN` in `.env`
5. Use the **OAuth2 URL Generator** to create an invite link with the `bot` scope and `View Channels` + `Read Message History` permissions
6. Invite the bot to your server using the generated URL
7. Optionally, copy a channel ID (right-click channel > Copy Channel ID) and set it as `DISCORD_CHANNEL_ID`

---

## Telegram Setup

1. Go to [my.telegram.org](https://my.telegram.org) and log in
2. Click **API development tools** and create a new application
3. Copy the `api_id` and `api_hash` values into `.env` as `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`
4. Run the one-time authentication script:
   ```bash
   npm run telegram:auth
   ```
5. Enter your phone number (with country code, e.g. `+84...`) and then the OTP Telegram sends you
6. Copy the printed session string into `.env` as `TELEGRAM_SESSION`
7. Optionally, set `TELEGRAM_CHANNEL_ID` to restrict monitoring to one channel or group

**Token address detection patterns:**

- EVM chains (Ethereum, BSC, Base, Arbitrum, etc.): `0x` followed by exactly 40 hex characters
- Solana: base58 string of 43–44 characters

---

## PM2 Commands

```bash
npm run pm2:start      # build + start under PM2
npm run pm2:restart    # build + restart (use after code changes)
npm run pm2:stop       # stop the process
npm run pm2:logs       # tail live logs
npm run pm2:delete     # remove from PM2 process list
```

**Survive reboots** — run once after first deploy:

```bash
pm2 save
pm2 startup            # prints a command to run with sudo
```

---

## HTTP Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status, uptime, timestamp }` |
| `GET` | `/webhook` | Triggers a call via the active provider |
| `GET` | `/test-sip` | Tests SIP call path directly (bypasses provider selection) |

---

## Further Documentation

| File | Contents |
|---|---|
| [docs/project-overview-pdr.md](./docs/project-overview-pdr.md) | Product requirements, alert lifecycle, non-goals, future ideas |
| [docs/system-architecture.md](./docs/system-architecture.md) | Architecture diagram, SIP call flow, PM2 config, env variable reference |
| [docs/codebase-summary.md](./docs/codebase-summary.md) | Directory tree, module dependency graph, data flow, design decisions |
| [docs/code-standards.md](./docs/code-standards.md) | TypeScript conventions, logging rules, error handling, naming |
| [SIP_SETUP.md](./docs/SIP_SETUP.md) | SIP federation explanation, full error log from development |
