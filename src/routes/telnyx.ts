import { Router } from 'express';

const router = Router();

// Telnyx calls this when the outbound call is answered — responds with TeXML
router.post('/telnyx/answer', (req, res) => {
  const message = (req.query.message as string) || 'You have a new alert.';

  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${message}</Say>
</Response>`);
});

export default router;
