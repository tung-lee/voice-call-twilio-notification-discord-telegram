import express from 'express';
import { errorHandler } from './middleware/index.js';
import { healthRouter, webhookRouter } from './routes/index.js';

const app = express();

// Request logging - log all incoming requests
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] >>> Incoming request: ${req.method} ${req.url}`);
  console.log(`  Content-Type: ${req.headers['content-type'] || 'none'}`);
  console.log(`  API-Key: ${req.headers['x-api-key'] ? 'provided' : 'missing'}`);
  next();
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Log request body after parsing
app.use((req, res, next) => {
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`  Body: ${JSON.stringify(req.body)}`);
  }
  next();
});

// Routes
app.use(healthRouter);
app.use(webhookRouter);

// Error handling
app.use(errorHandler);

export default app;
