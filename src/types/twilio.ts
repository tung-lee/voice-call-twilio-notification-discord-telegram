export interface VoiceCallOptions {
  to: string;
  message: string;
  voice?: string;
  language?: string;
}

export interface CallResult {
  success: boolean;
  callSid?: string;
  error?: string;
  errorCode?: number;
}
