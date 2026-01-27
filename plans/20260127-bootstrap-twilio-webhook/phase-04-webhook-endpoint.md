# Phase 4: Webhook Endpoint

## Context
Create the webhook endpoint that receives POST requests, validates payloads, authenticates via API key, and triggers voice calls.

## Overview
Implement a secure webhook route with request validation, API key authentication middleware, and integration with the voice service.

## Requirements
- Phase 3 completed
- Voice service functional
- Zod for payload validation

## Implementation Steps

### 1. Create API Key Auth Middleware
`src/middleware/apiKeyAuth.ts` - Validate X-API-Key header against configured key.

```typescript
// Reject if:
// - Header missing: 401 Unauthorized
// - Key invalid: 403 Forbidden
```

### 2. Define Webhook Payload Schema
`src/types/webhook.ts` - Define and validate incoming payload with Zod.

```typescript
const WebhookPayloadSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/),  // E.164 format
  message: z.string().min(1).max(1000),
  voice: z.string().optional(),
  language: z.string().optional(),
  callbackUrl: z.string().url().optional(),
});
```

### 3. Create Validation Middleware
`src/middleware/validatePayload.ts` - Generic Zod validation middleware factory.

### 4. Create Webhook Route
`src/routes/webhook.ts` - POST /webhook endpoint:
1. Authenticate request (API key)
2. Validate payload (Zod schema)
3. Call voice service
4. Return response with call SID or error

### 5. Response Format
```typescript
// Success (202 Accepted)
{ success: true, callSid: 'CA...', message: 'Call initiated' }

// Validation Error (400)
{ success: false, error: 'Validation failed', details: [...] }

// Auth Error (401/403)
{ success: false, error: 'Unauthorized' }

// Service Error (500)
{ success: false, error: 'Failed to initiate call' }
```

### 6. Register Routes
Update `src/app.ts` to include webhook routes with auth middleware.

## Todo

- [ ] Create `src/middleware/apiKeyAuth.ts` for X-API-Key validation
- [ ] Create `src/types/webhook.ts` with Zod payload schema
- [ ] Create `src/middleware/validatePayload.ts` for generic validation
- [ ] Create `src/routes/webhook.ts` with POST /webhook handler
- [ ] Integrate voice service in webhook handler
- [ ] Add proper HTTP status codes (202, 400, 401, 403, 500)
- [ ] Update `src/app.ts` to register webhook routes
- [ ] Add rate limiting consideration (document for future)
- [ ] Test with valid and invalid payloads
- [ ] Test with valid and invalid API keys

## Success Criteria

- POST /webhook requires X-API-Key header
- Missing API key returns 401 Unauthorized
- Invalid API key returns 403 Forbidden
- Invalid payload returns 400 with validation details
- Valid request returns 202 with call SID
- Voice call is initiated on valid request
- All requests/responses are logged
- Sensitive data (API key) not logged
