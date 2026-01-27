import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { logger } from '../utils/index.js';

export function validatePayload<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      logger.warn({ errors }, 'Payload validation failed');

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
