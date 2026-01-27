import type { RequestHandler } from 'express';
import { env } from '../config/index.js';
import { logger } from '../utils/index.js';

export const apiKeyAuth: RequestHandler = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    logger.warn({ url: req.url }, 'Missing API key');
    res.status(401).json({ success: false, error: 'API key required' });
    return;
  }

  if (apiKey !== env.API_KEY) {
    logger.warn({ url: req.url }, 'Invalid API key');
    res.status(403).json({ success: false, error: 'Invalid API key' });
    return;
  }

  next();
};
