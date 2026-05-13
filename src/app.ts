import express from 'express';
import { errorHandler } from './middleware/index.js';
import { healthRouter, webhookRouter, telnyxRouter } from './routes/index.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(healthRouter);
app.use(webhookRouter);
app.use(telnyxRouter);

app.use(errorHandler);

export default app;
