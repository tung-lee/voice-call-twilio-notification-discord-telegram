import { z } from 'zod';

// Webhook payload schema: { payload, source, reason }
export const WebhookPayloadSchema = z.object({
  payload: z.record(z.unknown()),  // any object
  source: z.string().min(1, 'Source is required'),
  reason: z.string().min(1, 'Reason is required'),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
