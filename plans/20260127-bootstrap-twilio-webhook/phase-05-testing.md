# Phase 5: Testing

## Context
Write comprehensive tests to ensure reliability of the webhook server, including unit tests for individual components and integration tests for the full request flow.

## Overview
Implement a test suite using Vitest covering configuration, middleware, services, and routes with mocked Twilio API calls.

## Requirements
- Phase 4 completed
- Vitest installed
- All components implemented

## Implementation Steps

### 1. Configure Vitest
`vitest.config.ts` - Set up test configuration with TypeScript support and coverage.

### 2. Create Test Utilities
`tests/utils/` - Helper functions for creating test fixtures and mocks.

```typescript
// Mock Twilio client
// Mock request/response objects
// Test payload generators
```

### 3. Unit Tests

**Config Tests** (`tests/unit/config.test.ts`)
- Valid environment loads correctly
- Missing required variables throws error
- Default values applied correctly

**Logger Tests** (`tests/unit/logger.test.ts`)
- Logger initializes with correct level
- Log methods work as expected

**Middleware Tests** (`tests/unit/middleware/`)
- `apiKeyAuth.test.ts`: Auth success/failure scenarios
- `validatePayload.test.ts`: Valid/invalid payloads
- `errorHandler.test.ts`: Error formatting

**Service Tests** (`tests/unit/services/`)
- `voiceService.test.ts`: Call initiation with mocked Twilio

### 4. Integration Tests

**Health Endpoint** (`tests/integration/health.test.ts`)
- GET /health returns 200 with status

**Webhook Endpoint** (`tests/integration/webhook.test.ts`)
- Full request flow with mocked Twilio
- Auth rejection scenarios
- Validation rejection scenarios
- Successful call initiation

### 5. Test Coverage
Target 80%+ coverage on:
- Statements
- Branches
- Functions
- Lines

## Todo

- [ ] Create `vitest.config.ts` with TypeScript and coverage settings
- [ ] Create `tests/utils/mocks.ts` for Twilio client mocking
- [ ] Create `tests/utils/fixtures.ts` for test data
- [ ] Write `tests/unit/config.test.ts`
- [ ] Write `tests/unit/middleware/apiKeyAuth.test.ts`
- [ ] Write `tests/unit/middleware/validatePayload.test.ts`
- [ ] Write `tests/unit/middleware/errorHandler.test.ts`
- [ ] Write `tests/unit/services/voiceService.test.ts`
- [ ] Write `tests/integration/health.test.ts`
- [ ] Write `tests/integration/webhook.test.ts`
- [ ] Add `npm run test` and `npm run test:coverage` scripts
- [ ] Verify coverage meets 80% threshold
- [ ] Add test documentation in README

## Success Criteria

- All tests pass with `npm run test`
- Coverage report shows 80%+ on all metrics
- Twilio API is never called during tests (mocked)
- Tests run in isolation (no shared state)
- CI-friendly (no external dependencies)
- Tests complete in under 30 seconds

## Test Commands

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Mock Strategy

```typescript
// Mock Twilio at module level
vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    calls: {
      create: vi.fn().mockResolvedValue({ sid: 'CA123...' })
    }
  }))
}));
```
