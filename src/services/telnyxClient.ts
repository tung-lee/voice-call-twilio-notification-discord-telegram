import Telnyx from 'telnyx';
import { env } from '../config/index.js';

export const telnyxClient = new Telnyx({ apiKey: env.TELNYX_API_KEY ?? '' });
