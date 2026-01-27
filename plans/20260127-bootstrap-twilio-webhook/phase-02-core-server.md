# Phase 2: Core Server

## Context
Build the Express server foundation with essential middleware, health checks, and logging infrastructure.

## Overview
Create a production-ready Express application with Pino logging, error handling, and health endpoints.

## Requirements
- Phase 1 completed
- Express and Pino installed
- TypeScript configuration ready

## Implementation Steps

### 1. Create Configuration Module
`src/config/index.ts` - Load and validate environment variables with Zod.

```typescript
// Required environment variables
- PORT (default: 3000)
- API_KEY (required)
- TWILIO_ACCOUNT_SID (required)
- TWILIO_AUTH_TOKEN (required)
- TWILIO_PHONE_NUMBER (required)
- LOG_LEVEL (default: 'info')
- NODE_ENV (default: 'development')
```

### 2. Create Logger Utility
`src/utils/logger.ts` - Configure Pino with appropriate log levels and formatting.

### 3. Create Express Application
`src/app.ts` - Set up Express with middleware stack:
- JSON body parser
- Pino HTTP request logging
- Error handling middleware

### 4. Create Health Check Route
`src/routes/health.ts` - Implement GET /health endpoint returning status and uptime.

### 5. Create Error Handler Middleware
`src/middleware/errorHandler.ts` - Centralized error handling with proper logging.

### 6. Create Server Entry Point
`src/server.ts` - Start Express server with graceful shutdown handling.

## Todo

- [ ] Create `src/config/index.ts` with Zod validation
- [ ] Create `src/types/index.ts` for shared interfaces
- [ ] Create `src/utils/logger.ts` with Pino configuration
- [ ] Create `src/middleware/errorHandler.ts`
- [ ] Create `src/middleware/requestLogger.ts` with pino-http
- [ ] Create `src/routes/health.ts` with GET /health endpoint
- [ ] Create `src/app.ts` with Express setup and middleware
- [ ] Create `src/server.ts` with startup and graceful shutdown
- [ ] Test health endpoint returns 200 OK
- [ ] Verify request logging works correctly

## Success Criteria

- Server starts on configured PORT
- GET /health returns `{ status: 'ok', uptime: number }`
- All requests are logged with request ID
- Invalid environment variables cause startup failure with clear error
- Graceful shutdown on SIGTERM/SIGINT
- Unhandled errors return 500 with proper JSON response
