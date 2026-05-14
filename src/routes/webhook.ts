import { Router } from 'express';
import { makeCall, ringViaSip } from '../services/index.js';
import { env } from '../config/index.js';

const router = Router();

router.get('/webhook', async (req, res, next) => {
  try {
    const result = await makeCall({
      to: env.CALL_TO_NUMBER,
      message: 'You have a new alert.',
    });

    if (result.success) {
      res.status(202).json({ success: true, callSid: result.callSid });
    } else {
      res.status(400).json({ success: false, error: result.error, errorCode: result.errorCode });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/test-sip', async (req, res, next) => {
  try {
    const result = await ringViaSip();
    if (result.success) {
      res.status(202).json({ success: true });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
