# System Architecture

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Host Machine / VPS                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PM2 Process Manager                       │   │
│  │                                                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │              alpha-signal-reminder (Node.js)          │  │   │
│  │  │                                                       │  │   │
│  │  │  ┌─────────────┐  ┌──────────────────────────────┐  │  │   │
│  │  │  │ Express App  │  │     Discord.js Client        │  │  │   │
│  │  │  │  port 3000  │  │  (WebSocket to discord.com)  │  │  │   │
│  │  │  │             │  └──────────────┬───────────────┘  │  │   │
│  │  │  │ GET /health │                 │ messageCreate     │  │   │
│  │  │  │ GET /webhook│  ┌──────────────────────────────┐  │  │   │
│  │  │  │ GET /test-sip│  │     GramJS Telegram Client   │  │  │   │
│  │  │  └──────┬──────┘  │  (MTProto to Telegram API)   │  │  │   │
│  │  │         │         └──────────────┬───────────────┘  │  │   │
│  │  │         └─────────────┬──────────┘                  │  │   │
│  │  │                       │                             │  │   │
│  │  │              ┌────────▼────────┐                    │  │   │
│  │  │              │  voiceService   │                    │  │   │
│  │  │              │   makeCall()    │                    │  │   │
│  │  │              └────────┬────────┘                    │  │   │
│  │  │                       │                             │  │   │
│  │  │           ┌───────────┴───────────┐                 │  │   │
│  │  │           │                       │                 │  │   │
│  │  │  ┌────────▼──────┐    ┌───────────▼──────┐         │  │   │
│  │  │  │sipCallService │    │  Twilio REST API  │         │  │   │
│  │  │  │ (sip npm pkg) │    │     client        │         │  │   │
│  │  │  └────────┬──────┘    └───────────┬──────┘         │  │   │
│  │  └──────────────────────────────────────────────────── ┘  │   │
│  └─────────────────────────────────────────────────────────────   │
│             │ UDP SIP INVITE              │ HTTPS REST            │
└─────────────────────────────────────────────────────────────────── ┘
              │                             │
              ▼                             ▼
   ┌──────────────────┐         ┌──────────────────────┐
   │  sip.linphone.org│         │    api.twilio.com     │
   │  (Flexisip)      │         │                      │
   └────────┬─────────┘         └──────────┬───────────┘
            │ Apple PushKit                 │ PSTN
            ▼                              ▼
   ┌──────────────────┐         ┌──────────────────────┐
   │   iPhone         │         │   Any phone number   │
   │   Linphone app   │         │   (CALL_TO_NUMBER)   │
   │   (CallKit UI)   │         │                      │
   └──────────────────┘         └──────────────────────┘
```

---

## Component Descriptions

### Express App (port 3000)

The HTTP server provides three endpoints. `/health` is used by PM2 or external monitors to confirm the process is alive. `/webhook` allows external tools or manual `curl` commands to trigger a call. `/test-sip` calls `ringViaSip()` directly, bypassing `voiceService.ts`, to isolate SIP behaviour during debugging.

The server is thin — no authentication, no rate limiting beyond the per-source cooldowns. It is expected to run on a private machine or VPS not exposed to the public internet.

### Discord.js Client

Opens a persistent WebSocket connection to Discord's gateway. Receives `messageCreate` events in real time. The `MessageContent` privileged intent must be enabled in the Discord Developer Portal for the bot to read message text. The client listens on all channels by default; set `DISCORD_CHANNEL_ID` to restrict to a single channel.

### GramJS Telegram Client

Connects to Telegram's MTProto API as a user account (not a bot). Uses a string session serialised from a one-time interactive authentication (`npm run telegram:auth`). The session is stored in the `TELEGRAM_SESSION` environment variable and is reused across restarts without re-authenticating. Telegram tracker is optional — if the three required Telegram variables are absent from `.env`, the tracker logs a warning and exits silently.

### voiceService.ts

The single call gateway. Reads `CALL_PROVIDER` from env at call time (not at import time) and dispatches to the appropriate implementation. This is intentionally not a class or registry — it is a plain function that delegates. Adding a new provider means adding a new branch to this function.

### sipCallService.ts

Implements SIP INVITE using the low-level `sip` npm package. Manages one active call at a time via the `sipActive` boolean flag. Picks a random local port in the range 5060–9060 to avoid collisions when the server restarts quickly. Binds the SIP stack to the machine's primary non-loopback IPv4 address, which is also written into the SDP and Via headers.

### twilioClient.ts

A module-level singleton. Twilio client construction is synchronous and reads credentials from `env`. Keeping it in a dedicated file prevents circular dependency issues if `voiceService.ts` were ever split.

---

## SIP Call Flow

This is the full sequence diagram for a successful SIP call using the federation method.

```
sipCallService.ts                sip.linphone.org              iPhone (Linphone)
      |                                 |                             |
      |-- sip.start() (UDP, random port)|                             |
      |                                 |                             |
      |-- INVITE sip:user@sip.linphone.org                           |
      |   From: sip:alertbot@iptel.org  |                             |
      |   Content-Type: application/sdp |                             |
      |-------------------------------->|                             |
      |                                 |                             |
      |<-- 100 Trying ------------------|                             |
      |   (ACK not required for 1xx)    |                             |
      |                                 |                             |
      |<-- 110 Push sent ---------------|                             |
      |   (proprietary Flexisip status) |                             |
      |                                 |-- Apple PushKit (APNS) ---->|
      |                                 |                             |
      |<-- 180 Ringing -----------------|                             |
      |                                 |   <CallKit UI appears>      |
      |   [start ring timer]            |                             |
      |                                 |                             |
      |         --- if user declines ---+-----------------------------+
      |<-- 603 Decline -----------------|                             |
      |-- ACK-------------------------->|                             |
      |   finish(success=true)          |                             |
      |                                 |                             |
      |         --- if ring timer fires -                             |
      |-- CANCEL----------------------->|                             |
      |<-- 200 OK (to CANCEL) ---------|                             |
      |<-- 487 Request Terminated ------|                             |
      |-- ACK (to 487) ---------------->|                             |
      |   finish(success=true)          |                             |
      |                                 |                             |
      |         --- if user answers ----+-----------------------------+
      |<-- 200 OK --------------------- |                             |
      |-- ACK-------------------------->|                             |
      |   [500ms delay]                 |                             |
      |-- BYE-------------------------->|                             |
      |<-- 200 OK --------------------- |                             |
      |   finish(success=true)          |                             |
```

Response codes handled:

| Code | Meaning | Action |
|---|---|---|
| 100 | Trying | Ignored (wait for further response) |
| 110 | Push sent | Ignored (Flexisip proprietary — confirms push was dispatched) |
| 180 | Ringing | Start ring duration timer |
| 183 | Session Progress | Same as 180 — start ring timer |
| 200 | OK (answered) | Send ACK, then BYE after 500ms |
| 487 | Request Terminated | Call was cancelled; resolve success |
| 603 | Decline | User dismissed — alert was delivered; resolve success |
| 4xx/5xx/6xx (other) | Error | Log and resolve failure |

---

## Why SIP Federation Works

`sip.linphone.org` runs Flexisip, Belledonne Communications' open-source SIP proxy. Flexisip is designed for multi-domain SIP federation, meaning it is built to accept calls from other SIP domains on behalf of registered users.

When an INVITE arrives with a `From:` header from an external domain (e.g., `iptel.org`), Flexisip treats it as a federated call: the caller is on their own domain, calling a local user. No registration is required of the caller. Flexisip looks up the local user (`ericle`), finds their registered device, and delivers the call via Apple PushKit.

When an INVITE arrives with a `From:` header claiming the same domain (`sip.linphone.org`), Flexisip treats it as a call from a local user — and local users must be registered. It issues a 407 Proxy Authentication Required challenge. Even if valid credentials are provided, the subsequent auth-retry is rejected with 403 Forbidden because the bot is not registered in Flexisip's user database.

This means the bot does not need an account on any SIP server. It only needs a plausible `From:` header that does not claim to be from `sip.linphone.org`.

The `SIP_BOT_DOMAIN` default is `iptel.org` because it is a well-known public SIP service that would be a plausible federated caller. Any other external domain would also work.

---

## Twilio Call Flow (Comparison)

```
voiceService.ts          api.twilio.com               CALL_TO_NUMBER
      |                        |                             |
      |-- POST /2010-04-01/Accounts/{SID}/Calls              |
      |   To: CALL_TO_NUMBER   |                             |
      |   From: TWILIO_PHONE_NUMBER                          |
      |   Twiml: <Response><Say>...</Say></Response>         |
      |----------------------->|                             |
      |                        |                             |
      |<-- 201 Created --------|                             |
      |   { sid: "CA..." }     |                             |
      |   callSid stored       |-- PSTN call placed -------->|
      |                        |                             |
      |   result.success=true  |   <phone rings>             |
```

Twilio is simpler to implement but costs approximately $0.013/minute. Trial accounts require the destination number to be manually verified in the Twilio console.

---

## PM2 Deployment Architecture

```
ecosystem.config.cjs
  name: 'alpha-signal-reminder'
  script: './dist/server.js'    ← compiled output, not source
  instances: 1                  ← single instance (SIP uses global UDP socket)
  autorestart: true             ← restart on crash
  watch: false                  ← do not watch files (use pm2:restart for deploys)
  max_memory_restart: '256M'    ← restart if RSS exceeds 256MB
  NODE_ENV: 'production'        ← sets JSON logging (no pino-pretty)
```

The process must run as a single instance because `sipCallService.ts` uses the `sip` package's global UDP socket. Multiple instances would bind the same port and conflict. If horizontal scaling were needed, the SIP implementation would need to be refactored to use a per-instance socket with dynamic port assignment, and the `sipActive` flag would need to be moved to a shared store.

PM2 reads environment variables from the host environment (your `.env` file must be loaded). The `dotenv` call in `env.ts` handles this at startup. To ensure PM2 picks up `.env`, start it with:

```bash
npm run pm2:start   # runs: npm run build && pm2 start ecosystem.config.cjs
```

To survive system reboots, run once after initial setup:

```bash
pm2 save
pm2 startup
```

`pm2 startup` prints a command to run (requires sudo) that installs PM2 as a system service.

---

## Environment Variable Groupings

### Server

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP server listen port |
| `NODE_ENV` | `development` | Controls log format (JSON in production) |
| `LOG_LEVEL` | `info` | Pino log level threshold |

### Call routing

| Variable | Default | Purpose |
|---|---|---|
| `CALL_PROVIDER` | `sip` | Active call provider: `sip` or `twilio` |
| `CALL_TO_NUMBER` | required | E.164 phone number to call (all providers) |

### Twilio

| Variable | Default | Purpose |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | required | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | required | Twilio API secret |
| `TWILIO_PHONE_NUMBER` | required | Twilio caller ID (E.164) |

Twilio credentials are required by Zod schema even when `CALL_PROVIDER=sip`. This is a current limitation — the schema validates all fields regardless of provider.

### Discord

| Variable | Default | Purpose |
|---|---|---|
| `DISCORD_BOT_TOKEN` | required | Bot authentication token |
| `DISCORD_COOLDOWN_MS` | `300000` | Minimum ms between Discord-triggered calls |
| `DISCORD_CHANNEL_ID` | optional | Restrict monitoring to one channel; blank = all |

### Telegram

| Variable | Default | Purpose |
|---|---|---|
| `TELEGRAM_API_ID` | optional | MTProto app ID from my.telegram.org |
| `TELEGRAM_API_HASH` | optional | MTProto app hash from my.telegram.org |
| `TELEGRAM_SESSION` | optional | Serialised GramJS session string |
| `TELEGRAM_CHANNEL_ID` | optional | Restrict monitoring to one channel; blank = all |
| `TELEGRAM_COOLDOWN_MS` | `300000` | Minimum ms between Telegram-triggered calls |

All four Telegram variables must be set together. If any is missing, the tracker is disabled.

### SIP

| Variable | Default | Purpose |
|---|---|---|
| `SIP_BOT_USER` | `alertbot` | Caller username in `From:` header (any string) |
| `SIP_BOT_DOMAIN` | `iptel.org` | Caller domain — must not be `sip.linphone.org` |
| `SIP_TARGET_USER` | `ericle` | Your Linphone username on sip.linphone.org |
| `SIP_TARGET_DOMAIN` | `sip.linphone.org` | Target SIP registrar with PushKit support |
| `SIP_RING_DURATION_MS` | `30000` | Ring timeout in ms before auto-cancel |

---

## Port Usage

| Port | Protocol | Purpose |
|---|---|---|
| `3000` | TCP/HTTP | Express server (configurable via `PORT`) |
| `5060–9060` | UDP/SIP | SIP stack — random port chosen per call, bound to local IP |

The SIP port range is not configurable. A new port is drawn from `5060 + Math.floor(Math.random() * 4000)` each time `ringViaSip()` is called. The SIP stack is stopped (`sip.stop()`) 300ms after the call completes, releasing the port. Only one SIP call can be active at a time.
