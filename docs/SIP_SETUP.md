# Free SIP Phone Ring via Linphone — Setup & Troubleshooting

This doc explains how the free SIP calling works and every error we hit along the way.

---

## How It Works

Instead of paying Twilio/Telnyx to call your phone number, this system sends a **SIP INVITE** directly to `sip.linphone.org`. The server:
1. Receives the INVITE
2. Sends a **push notification** to your iOS Linphone app (status: `110 Push sent`)
3. Linphone wakes up in the **background** and rings (status: `180 Ringing`)

This is completely free and works even when the app is closed.

### SIP flow

```
Bot → INVITE sip:ericle@sip.linphone.org
      ← 100 Trying
      ← 110 Push sent     (push notification dispatched to iPhone)
      ← 180 Ringing       (Linphone app woke up, showing call UI)
      ← 603 Decline       (user dismissed) or 200 OK (answered)
Bot → ACK / BYE
```

### Key discovery: SIP federation

`sip.linphone.org` accepts federated calls from **external SIP domains**. The bot does not need to register anywhere. It just needs a `From:` header that looks like it comes from a different domain (e.g. `sip:alertbot@iptel.org`).

If the `From:` domain is `sip.linphone.org` itself, the server demands that user be registered first → 407 → auth → **403 Forbidden**. Using any other domain bypasses this.

---

## Setup

### 1. Install Linphone on iPhone

Download from the App Store: **Linphone**

### 2. Create a free account

In the Linphone app → Assistant → **Create a Linphone account**

Example: `ericle@sip.linphone.org`

Keep the app installed and logged in. It does not need to be open — push notifications wake it up.

### 3. Configure `.env`

```env
CALL_PROVIDER=sip

SIP_BOT_USER=alertbot          # any name — not a real account
SIP_BOT_DOMAIN=iptel.org       # any external domain — NOT sip.linphone.org
SIP_TARGET_USER=ericle         # your Linphone username
SIP_TARGET_DOMAIN=sip.linphone.org
SIP_RING_DURATION_MS=30000     # ring for 30s then auto hang-up
```

### 4. Test

```bash
curl http://localhost:3000/test-sip
# → {"success":true}
```

Your iPhone should ring within 3–5 seconds.

---

## Errors We Hit and How We Fixed Them

### 1. `sip.linphone.org` returns `403 Forbidden` on REGISTER

**When:** Trying to register the bot directly at `sip.linphone.org`.

**Error:**
```
REGISTER failed: 403
```

**Cause:** `sip.linphone.org` (Flexisip server) intentionally blocks third-party SIP client registrations. It only allows registrations from the official Linphone SDK. Spoofing the `User-Agent` header (`LinphoneApp/6.0.0`) did not help — the server detects it at a protocol level.

**Fix:** Don't register at `sip.linphone.org`. Instead, use SIP federation — see section 4.

---

### 2. `sip2sip.info` TCP port 5060 `ECONNREFUSED`

**When:** Trying to REGISTER the bot at `sip2sip.info` using TCP transport.

**Error:**
```
Error: connect ECONNREFUSED 174.142.205.18:5060
Error: connect ECONNREFUSED 212.95.45.157:5060
REGISTER failed: 503
```

**Cause:** `sip2sip.info` blocks TCP port 5060 from Vietnamese IP addresses (geo-blocking). Both resolved IPs refused the connection.

**Fix:** Tried UDP (see section 3). Ultimately abandoned `sip2sip.info` entirely.

---

### 3. `sip2sip.info` UDP REGISTER times out with `408`

**When:** Switching to UDP transport for `sip2sip.info`.

**Error:**
```json
{"success": false, "error": "REGISTER failed: 408"}
```

**Cause:** `sip2sip.info` was not responding to our UDP REGISTER packets at all. No SIP RECV in logs — the server silently dropped our packets. Two sub-issues were investigated:

**Sub-issue A — Via header showed `Mac-tung-lee.local` hostname:**

The `sip` npm library sets the Via header host from `options.hostname || os.hostname()`. The system hostname (`.local` mDNS) is unreachable from the internet.

Fix — pass `address` and `hostname` to `sip.start()`:
```typescript
sip.start({
  port,
  address: localIp,   // binds to this IP
  hostname: localIp,  // used in Via header
  ...
})
```

**Sub-issue B — Still 408 after fixing hostname:**

Even with the correct local IP in the Via header, `sip2sip.info` never responded. UDP 5060 was "reachable" (`nc -zuv sip2sip.info 5060` succeeds) but SIP packets were dropped — likely geo-blocked at the SIP application layer.

**Fix:** Abandoned `sip2sip.info`. Used direct federated INVITE instead.

---

### 4. Direct INVITE to `sip.linphone.org` returns `403` when `From` domain is also `sip.linphone.org`

**When:** Sending INVITE directly to `ericle@sip.linphone.org` with `From: sip:ericbot@sip.linphone.org`.

**SIP exchange:**
```
→ INVITE sip:ericle@sip.linphone.org
← 407 Proxy Authentication Required
→ INVITE (with Proxy-Authorization)
← 403 Forbidden
```

**Cause:** When the `From:` domain is `sip.linphone.org`, the server treats this as a local user making a call. It challenges with 407, authenticates the credentials, then checks if `ericbot` is currently registered. Since the bot isn't registered (we skipped REGISTER because it returns 403), the server rejects with 403.

**Fix:** Change `SIP_BOT_DOMAIN` to any external domain that is **not** `sip.linphone.org`. We used `iptel.org`:

```env
SIP_BOT_DOMAIN=iptel.org
```

With `From: sip:ericbot@iptel.org`, `sip.linphone.org` treats the call as a **federated call** from an external SIP domain. It does not require the caller to be registered — it just delivers the call to `ericle` via push notification.

**Result:**
```
→ INVITE sip:ericle@sip.linphone.org  (From: sip:ericbot@iptel.org)
← 100 Trying
← 110 Push sent      ✓ push notification sent to iPhone
← 180 Ringing        ✓ Linphone woke up and is ringing
← 603 Decline        ✓ user dismissed the call
```

**No registration needed. No credentials needed. Completely free.**

---

## Why Not Other Providers

| Provider | Issue |
|---|---|
| `sip.linphone.org` REGISTER | Intentionally blocks third-party SIP clients (403) |
| `sip2sip.info` TCP 5060 | ECONNREFUSED — geo-blocked from Vietnam |
| `sip2sip.info` UDP 5060 | 408 timeout — packets dropped silently |
| `sip.linphone.org` INVITE (From: same domain) | 403 after auth — requires caller to be registered |
| **`sip.linphone.org` INVITE (From: external domain)** | **Works — accepted as federated call** |

---

## Why Background Ring Works

iOS normally suspends apps in the background. VoIP calls work because Apple provides **PushKit** — a special high-priority push channel reserved for incoming calls. When `sip.linphone.org` receives an INVITE for a registered Linphone user, it sends a PushKit notification to the device. iOS wakes Linphone immediately and shows the call UI (CallKit), even if the app was force-closed.

This is why the bot must call `ericle@sip.linphone.org` — that server has the PushKit integration. A call to `ericle@sip2sip.info` would only ring if the app is open.

---

## Env Reference

| Variable | Required | Description |
|---|---|---|
| `CALL_PROVIDER` | yes | Set to `sip` to use this |
| `SIP_BOT_USER` | no | Caller username — any string (default: `alertbot`) |
| `SIP_BOT_DOMAIN` | no | Caller domain — must NOT be `sip.linphone.org` (default: `iptel.org`) |
| `SIP_TARGET_USER` | yes | Your Linphone username |
| `SIP_TARGET_DOMAIN` | no | Target SIP server (default: `sip.linphone.org`) |
| `SIP_RING_DURATION_MS` | no | Ring timeout in ms before auto hang-up (default: `30000`) |
