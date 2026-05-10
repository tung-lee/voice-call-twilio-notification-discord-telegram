export interface VoiceCallOptions {
  to: string;
  message: string;
}

export interface CallResult {
  success: boolean;
  callSid?: string;
  error?: string;
  errorCode?: number;
}
