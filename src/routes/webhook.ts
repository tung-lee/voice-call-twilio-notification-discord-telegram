import { Router } from 'express';
import { apiKeyAuth, validatePayload } from '../middleware/index.js';
import { makeCall } from '../services/index.js';
import { WebhookPayloadSchema, type WebhookPayload } from '../types/index.js';

const router = Router();

router.post(
  '/webhook',
  apiKeyAuth,
  validatePayload(WebhookPayloadSchema),
  async (req, res, next) => {
    try {
      const { payload, source, reason } = req.body as WebhookPayload;

      console.log(`Webhook from: ${source}, reason: ${reason}`);
      console.log(`Payload:`, payload);

      const message = `Alert from ${source}. Reason: ${reason}`;

      const result = await makeCall({
        to: "+84376594385",
        message,
      });

      if (result.success) {
        res.status(202).json({
          success: true,
          callSid: result.callSid,
          message: 'Call initiated',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          errorCode: result.errorCode,
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
