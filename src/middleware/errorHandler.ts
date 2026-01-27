import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/index.js';
import { env } from '../config/index.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler: ErrorRequestHandler = (err: AppError, req, res, _next) => {
  const statusCode = err.statusCode || 500;

  logger.error({
    err,
    method: req.method,
    url: req.url,
    statusCode,
  }, 'Request error');

  res.status(statusCode).json({
    success: false,
    error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
