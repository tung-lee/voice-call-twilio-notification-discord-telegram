import twilio from 'twilio';
import { twilioClient } from './twilioClient.js';
import { env } from '../config/index.js';
import { logger } from '../utils/index.js';
import type { VoiceCallOptions, CallResult } from '../types/index.js';

const { VoiceResponse } = twilio.twiml;

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export function validatePhoneNumber(phone: string): boolean {
  return E164_REGEX.test(phone);
}

export function generateTwiML(message: string, voice = 'Polly.Amy', language = 'en-US'): string {
  const response = new VoiceResponse();
  response.say({ voice, language }, message);
  return response.toString();
}

export async function makeCall(options: VoiceCallOptions): Promise<CallResult> {
  const { to, message, voice = 'Polly.Amy', language = 'en-US' } = options;

  if (!validatePhoneNumber(to)) {
    return { success: false, error: 'Invalid phone number format. Use E.164 format (+1234567890)' };
  }

  const twimlContent = generateTwiML(message, voice, language);

  logger.info({ to, voice, language }, 'Initiating voice call');

  try {
    const call = await twilioClient.calls.create({
      twiml: twimlContent,
      to,
      from: env.TWILIO_PHONE_NUMBER,
    });

    logger.info({ callSid: call.sid, to }, 'Call initiated successfully');

    return { success: true, callSid: call.sid };
  } catch (error) {
    const twilioError = error as { code?: number; message?: string };

    logger.error({ error: twilioError, to }, 'Failed to initiate call');

    // Handle common Twilio error codes
    if (twilioError.code === 21211) {
      return { success: false, error: 'Invalid phone number', errorCode: 21211 };
    }
    if (twilioError.code === 21214) {
      return { success: false, error: 'Phone number not verified (trial account limitation)', errorCode: 21214 };
    }
    if (twilioError.code === 21608) {
      return { success: false, error: 'Unverified caller ID', errorCode: 21608 };
    }

    return {
      success: false,
      error: twilioError.message || 'Failed to initiate call',
      errorCode: twilioError.code,
    };
  }
}
