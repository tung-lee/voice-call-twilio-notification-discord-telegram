# Codebase Summary

## Directory Tree

```
src/
├── server.ts               Entry point: starts HTTP server, boots Discord + Telegram, handles shutdown
├── app.ts                  Express app factory: middleware, router mounting, error handler
│
├── config/
│   ├── env.ts              Zod schema for all environment variables; exits process on validation failure
│   └── index.ts            Re-exports env from env.ts
│
├── middleware/
│   ├── errorHandler.ts     Express error handler; hides stack traces in production
│   └── index.ts            Re-exports errorHandler
│
├── routes/
│   ├── health.ts           GET /health — returns status, uptime, timestamp
│   ├── webhook.ts          GET /webhook (triggers makeCall), GET /test-sip (tests SIP directly)
│   └── index.ts            Re-exports healthRouter, webhookRouter
│
├── services/
│   ├── discordBot.ts       Discord.js client; monitors messages; applies cooldown; calls makeCall()
│   ├── telegramTracker.ts  GramJS client; detects EVM/Solana addresses in messages; applies cooldown; calls makeCall()
│   ├── voiceService.ts     Provider abstraction: routes makeCall() to SIP or Twilio based on CALL_PROVIDER
│   ├── sipCallService.ts   Raw SIP INVITE implementation using the `sip` npm package (CommonJS)
│   ├── twilioClient.ts     Singleton Twilio REST client
│   └── index.ts            Barrel: re-exports all public service symbols
│
├── scripts/
│   ├── telegram-auth.ts    One-time interactive CLI to authenticate a Telegram user account and print session string
│   └── input.d.ts          Type declaration shim for the `input` npm package
│
├── types/
│   ├── twilio.ts           VoiceCallOptions and CallResult interface definitions
│   └── index.ts            Re-exports all types
│
└── utils/
    ├── logger.ts           Pino logger instance (pino-pretty in dev, JSON in prod)
    └── index.ts            Re-exports logger
```

---

## Module Dependency Graph

```
server.ts
  ├── app.ts
  │     ├── middleware/errorHandler.ts
  │     │     ├── utils/logger.ts
  │     │     └── config/env.ts
  │     └── routes/
  │           ├── health.ts
  │           └── webhook.ts
  │                 └── services/index.ts
  │                       └── voiceService.ts (+ sipCallService.ts, twilioClient.ts)
  │
  └── services/index.ts
        ├── discordBot.ts
        │     ├── config/env.ts
        │     ├── utils/logger.ts
        │     └── voiceService.ts
        │
        ├── telegramTracker.ts
        │     ├── config/env.ts
        │     ├── utils/logger.ts
        │     └── voiceService.ts
        │
        ├── voiceService.ts
        │     ├── sipCallService.ts
        │     │     ├── config/env.ts
        │     │     └── utils/logger.ts
        │     ├── twilioClient.ts
        │     │     └── config/env.ts
        │     ├── config/env.ts
        │     ├── utils/logger.ts
        │     └── types/index.ts
        │
        └── sipCallService.ts (direct export for test-sip route)
```

All modules ultimately depend on `config/env.ts` (for configuration) and `utils/logger.ts` (for structured logging). Neither is injected — both are imported directly as singletons.

---

## Data Flow

### Discord path

```
Discord server message
  → discord.js fires messageCreate event
  → discordBot.ts checks DISCORD_CHANNEL_ID filter
  → CallCooldown.isInCooldown() — skip or proceed
  → CallCooldown.reset()
  → makeCall({ to: env.CALL_TO_NUMBER, message: 'You have a new message in Discord.' })
  → voiceService.ts routes by CALL_PROVIDER
      → SIP: ringViaSip() → sip npm → INVITE to sip.linphone.org → PushKit → iPhone rings
      → Twilio: twilioClient.calls.create() → PSTN call → phone rings
```

### Telegram path

```
Telegram channel message (MTProto event via GramJS)
  → telegramTracker.ts NewMessage event handler fires
  → extractTokenAddresses(text) — regex for EVM 0x... and Solana base58
  → if addresses.length === 0: return (no call)
  → TelegramCooldown.isInCooldown() — skip or proceed
  → TelegramCooldown.reset()
  → makeCall({ to: env.CALL_TO_NUMBER, message: 'New token address detected in your Telegram channel.' })
  → same voiceService.ts routing as Discord path
```

### HTTP webhook path

```
GET /webhook
  → webhook.ts route handler
  → makeCall({ to: env.CALL_TO_NUMBER, message: 'You have a new alert.' })
  → voiceService.ts routing
  → 202 Accepted or 400 with error details
```

---

## Key Design Decisions

### SIP federation trick

The `sip` npm package sends a raw SIP INVITE with no prior REGISTER. The `From:` header uses a fictional identity on an external domain (`alertbot@iptel.org`). When `sip.linphone.org` receives an INVITE from an unrecognised domain, it treats it as a federated call from a peered SIP network and delivers it via PushKit without requiring the caller to be registered. If `From:` used `sip.linphone.org` as its domain, the server would demand registration (407 auth challenge followed by 403 Forbidden once it confirmed the user is not registered).

### ESM with createRequire for the sip package

The project uses `"type": "module"` in `package.json` — all `.ts` files compile to ESM. The `sip` npm package is a CommonJS module with no ESM export. `import sip from 'sip'` fails at runtime in strict ESM mode. The fix is to create a local `require` function using Node's built-in `createRequire(import.meta.url)` and use that to load `sip` as a CommonJS module. This is the canonical Node.js interop pattern for this scenario.

### Zod environment validation

All configuration is validated at startup via a Zod schema in `src/config/env.ts`. If any required variable is missing or has an invalid format (e.g., a non-E.164 phone number), the process prints a detailed error and exits immediately. This fail-fast approach prevents the server from starting in a broken state and makes misconfiguration visible at boot rather than at runtime when a call is attempted.

### Provider abstraction in voiceService.ts

`makeCall()` is the single call site for all call triggers. It reads `CALL_PROVIDER` and dispatches to either `ringViaSip()` or `makeCallViaTwilio()`. This means `discordBot.ts`, `telegramTracker.ts`, and the webhook route all make the same call without knowing which provider is active. Switching providers requires only a `.env` change.

### Cooldown classes per source

Each signal source (Discord, Telegram) has its own `CallCooldown` or `TelegramCooldown` class instance with independent state. This means a burst of Telegram signals can silence Telegram calls while Discord calls still go through, and vice versa. The cooldown window is configurable per source via `DISCORD_COOLDOWN_MS` and `TELEGRAM_COOLDOWN_MS`.

---

## Service Responsibilities

### discordBot.ts

Creates and manages a Discord.js client with `MessageContent` intent. On each incoming message, it applies a cooldown check and calls `makeCall()` if the cooldown has expired. The bot token and optional channel ID filter are read from `env`. Exposes `startDiscordBot()` and `stopDiscordBot()` for lifecycle management from `server.ts`.

### telegramTracker.ts

Creates a GramJS `TelegramClient` using a pre-authenticated string session. Registers a `NewMessage` event handler that runs two regex patterns against message text to find EVM and Solana token contract addresses. Only messages containing at least one address proceed to the cooldown check and call. Exposes `startTelegramTracker()` and `stopTelegramTracker()` for lifecycle management.

### voiceService.ts

Acts as the call provider router. `makeCall()` checks `CALL_PROVIDER` and delegates to `ringViaSip()` for SIP or `makeCallViaTwilio()` for Twilio. Contains E.164 phone number validation, TwiML generation, and Twilio-specific error code mapping. Returns a `CallResult` object in all cases.

### sipCallService.ts

Implements the full SIP INVITE dialog using the CommonJS `sip` package (loaded via `createRequire`). Generates a local SDP, picks a random port in the 5060–9060 range, and sends an INVITE to the target SIP URI. Handles response codes 100, 110, 180, 183, 200, 487, and 603. Auto-cancels the call after `SIP_RING_DURATION_MS` if the call is not answered. Uses a module-level `sipActive` flag to prevent concurrent SIP calls, since the `sip` package uses a single global UDP socket.

### twilioClient.ts

Creates and exports a singleton Twilio REST client instance. Reads credentials from `env` at import time. Keeps the client construction out of `voiceService.ts` to allow the client to be imported and tested independently.
