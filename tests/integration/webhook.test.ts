import '../setup.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

// Mock Twilio
vi.mock('twilio', () => {
  return {
    default: () => ({
      calls: {
        create: vi.fn().mockResolvedValue({ sid: 'CA_test_sid_123' }),
      },
    }),
    twiml: {
      VoiceResponse: vi.fn().mockImplementation(() => ({
        say: vi.fn(),
        toString: () => '<?xml version="1.0"?><Response><Say>Test</Say></Response>',
      })),
    },
  };
});

describe('POST /webhook', () => {
  const validPayload = {
    phoneNumber: '+14155551234',
    message: 'Hello, this is a test message',
  };

  it('should return 401 without API key', async () => {
    const response = await request(app)
      .post('/webhook')
      .send(validPayload);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'API key required');
  });

  it('should return 403 with invalid API key', async () => {
    const response = await request(app)
      .post('/webhook')
      .set('X-API-Key', 'wrong-key')
      .send(validPayload);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error', 'Invalid API key');
  });

  it('should return 400 for invalid payload', async () => {
    const response = await request(app)
      .post('/webhook')
      .set('X-API-Key', 'test-api-key')
      .send({ phoneNumber: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Validation failed');
  });

  it('should return 202 for valid request', async () => {
    const response = await request(app)
      .post('/webhook')
      .set('X-API-Key', 'test-api-key')
      .send(validPayload);

    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('callSid');
  });
});
