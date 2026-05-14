# Code Standards

These standards apply to all code in this repository. They reflect decisions already made in the existing codebase and must be followed consistently in any future modifications or additions.

---

## Language and Runtime

- **Language:** TypeScript 5.x, strict mode enabled (`"strict": true` in `tsconfig.json`)
- **Runtime:** Node.js with ESM (`"type": "module"` in `package.json`)
- **Compilation target:** ES2022 (`"target": "ES2022"` in `tsconfig.json`)
- **Module resolution:** NodeNext (`"module": "NodeNext"`, `"moduleResolution": "NodeNext"`)
- **Output directory:** `dist/` — never commit `dist/` content

---

## File Naming

- All source files use camelCase: `voiceService.ts`, `discordBot.ts`, `errorHandler.ts`
- File extension is always `.ts` in source
- Import paths within source files must use the `.js` extension even though the source file is `.ts`:

```typescript
// Correct
import { env } from '../config/index.js';
import { logger } from '../utils/index.js';

// Wrong — will fail at runtime with NodeNext resolution
import { env } from '../config/index';
import { logger } from '../utils/logger';
```

This is required by NodeNext module resolution. TypeScript rewrites `.ts` to `.js` in the output, and Node expects `.js` imports in ESM mode.

---

## Module System

- All project code uses ESM (`import`/`export` syntax)
- Do not use `require()` anywhere in project code
- **Exception:** CommonJS npm packages that have no ESM export must be loaded using `createRequire`:

```typescript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sip = require('sip');
```

This is the only sanctioned use of `require` in this codebase. The `sip` package is the only current case.

---

## Environment Configuration

All environment variable access must go through `src/config/env.ts`. Never read `process.env` directly in any module other than `env.ts` itself.

```typescript
// Correct
import { env } from '../config/index.js';
const port = env.PORT;

// Wrong
const port = process.env.PORT;
```

To add a new configuration variable:

1. Add it to the Zod schema in `src/config/env.ts`
2. Mark it `.optional()` if it is not required for the server to start
3. Provide a `.default()` value for any variable that has a safe fallback
4. Add it to `.env.example` with a placeholder value and an inline comment

---

## Logging

Always use the `logger` instance from `src/utils/logger.ts`. Never use `console.log`, `console.error`, or `console.warn` in service or route code. The `server.ts` entry point uses `console.log` for the startup banner only — this is intentional and should not be replicated elsewhere.

```typescript
// Correct
import { logger } from '../utils/index.js';
logger.info({ callSid: call.sid, to }, 'Call initiated successfully');
logger.error({ err }, 'Failed to connect Discord bot');
logger.debug({ remaining: 42 }, 'Skipping call — in cooldown');

// Wrong
console.log('Call initiated');
console.error(err);
```

Log entries must include a context object as the first argument when there is any relevant data to attach. The message string is the second argument and must be a static string — do not interpolate variables into the message string.

Log levels:

| Level | When to use |
|---|---|
| `error` | Operation failed; caller or user needs to take action |
| `warn` | Degraded operation; system continues but something is wrong |
| `info` | Normal lifecycle event (startup, connection, call initiated) |
| `debug` | Skipped operations or detailed state (cooldown skip, SIP response codes not worth warning about) |

---

## Error Handling

Express route handlers must catch all errors and pass them to `next(error)`:

```typescript
router.get('/webhook', async (req, res, next) => {
  try {
    const result = await makeCall({ ... });
    res.status(202).json(result);
  } catch (error) {
    next(error);  // passes to errorHandler middleware
  }
});
```

For errors that should return a specific HTTP status code, attach `statusCode` to the error object using the `AppError` interface:

```typescript
import type { AppError } from '../middleware/errorHandler.js';

const err: AppError = new Error('Resource not found');
err.statusCode = 404;
next(err);
```

Service functions (non-Express code) must not throw for expected failure cases. Return a result object instead:

```typescript
// Correct — caller decides how to handle failure
return { success: false, error: 'SIP call already in progress' };

// Wrong — forces all callers to use try/catch for expected states
throw new Error('SIP call already in progress');
```

Only throw from service functions for truly unexpected failures (programming errors, corrupt state).

---

## Type Definitions

- Define shared interfaces and types in `src/types/`
- One file per domain: `twilio.ts` contains `VoiceCallOptions` and `CallResult`
- Import types via the barrel at `src/types/index.ts`:

```typescript
import type { VoiceCallOptions, CallResult } from '../types/index.js';
```

- Use `import type` for type-only imports to keep runtime bundles clean
- Do not define ad-hoc inline types for anything used across more than one file

---

## Service Exports

All public symbols from `src/services/` must be exported through the barrel at `src/services/index.ts`. Route files and `server.ts` import from the barrel, not from individual service files.

```typescript
// Correct — import from barrel
import { makeCall, startDiscordBot } from '../services/index.js';

// Wrong — bypasses barrel
import { makeCall } from '../services/voiceService.js';
```

The barrel exists in `server.ts` imports and in route files. Individual services may import directly from peer services when they have a clear dependency (e.g., `voiceService.ts` imports `ringViaSip` from `sipCallService.ts`).

---

## Comments

Write comments only to explain **why** something is done, not **what** it does. Code that is readable should not be narrated.

```typescript
// Correct — explains non-obvious reasoning
// 603 Decline means the user dismissed the call — still a success, the alert was delivered
finish(true);

// Correct — explains a counterintuitive external system constraint
// External domain bypasses sip.linphone.org registration check (see SIP_SETUP.md)
const botDomain = env.SIP_BOT_DOMAIN;

// Wrong — narrates what the code already says clearly
// Check if the cooldown is active
if (cooldown.isInCooldown()) { ... }

// Wrong — explains a variable name that is self-documenting
// The SIP ring duration in milliseconds
const ringDuration = env.SIP_RING_DURATION_MS;
```

---

## Build Before Deploy

Always run `npm run build` before deploying or restarting PM2. The `pm2:start` and `pm2:restart` scripts do this automatically. If you restart PM2 directly with `pm2 restart`, you will be running stale compiled output.

```bash
# Safe — includes build step
npm run pm2:restart

# Unsafe — skips build, runs whatever was last compiled
pm2 restart alpha-signal-reminder
```

Run `npm run typecheck` before committing to catch TypeScript errors without producing output files.
