import '../setup.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiKeyAuth } from '../../src/middleware/apiKeyAuth.js';
import { validatePayload } from '../../src/middleware/validatePayload.js';

describe('apiKeyAuth middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { headers: {}, url: '/test' };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('should return 401 if API key is missing', () => {
    apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'API key required',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 if API key is invalid', () => {
    mockReq.headers = { 'x-api-key': 'wrong-key' };

    apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid API key',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next if API key is valid', () => {
    mockReq.headers = { 'x-api-key': 'test-api-key' };

    apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});

describe('validatePayload middleware', () => {
  const testSchema = z.object({
    name: z.string(),
    age: z.number(),
  });

  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('should return 400 for invalid payload', () => {
    mockReq.body = { name: 123 };

    validatePayload(testSchema)(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Validation failed',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next for valid payload', () => {
    mockReq.body = { name: 'John', age: 30 };

    validatePayload(testSchema)(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});
