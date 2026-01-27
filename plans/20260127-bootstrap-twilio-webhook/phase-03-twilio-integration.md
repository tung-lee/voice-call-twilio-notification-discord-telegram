# Phase 3: Twilio Integration

## Context
Implement the Twilio client wrapper and voice call service to make outbound calls with Text-to-Speech messages.

## Overview
Create a service layer that abstracts Twilio SDK operations, handles TTS voice configuration, and provides error handling for call failures.

## Requirements
- Phase 2 completed
- Twilio trial account with verified phone number
- Understanding of Twilio Voice API and TwiML

## Implementation Steps

### 1. Create Twilio Types
`src/types/twilio.ts` - Define interfaces for call options and responses.

```typescript
interface VoiceCallOptions {
  to: string;           // Destination phone number (E.164 format)
  message: string;      // TTS message content
  voice?: string;       // TTS voice (default: 'Polly.Amy')
  language?: string;    // Language code (default: 'en-US')
}

interface CallResult {
  success: boolean;
  callSid?: string;
  error?: string;
}
```

### 2. Create Twilio Client Factory
`src/services/twilioClient.ts` - Initialize and export configured Twilio client.

### 3. Create Voice Call Service
`src/services/voiceService.ts` - Implement voice call logic:
- Generate TwiML for TTS
- Initiate outbound call
- Handle Twilio errors gracefully
- Log call attempts and results

### 4. TwiML Generation
Use Twilio's VoiceResponse to create TTS responses:
```typescript
const twiml = new VoiceResponse();
twiml.say({ voice: 'Polly.Amy', language: 'en-US' }, message);
```

### 5. Phone Number Validation
Implement E.164 format validation for destination numbers.

## Todo

- [ ] Create `src/types/twilio.ts` with VoiceCallOptions and CallResult interfaces
- [ ] Create `src/services/twilioClient.ts` to initialize Twilio client
- [ ] Create `src/services/voiceService.ts` with makeCall function
- [ ] Implement TwiML generation for TTS messages
- [ ] Add phone number validation (E.164 format)
- [ ] Add error handling for Twilio API errors
- [ ] Add logging for call attempts and outcomes
- [ ] Create `src/services/index.ts` to export services
- [ ] Test with actual Twilio trial account (verified number only)
- [ ] Document Twilio trial limitations in comments

## Success Criteria

- Twilio client initializes with credentials from environment
- makeCall function accepts VoiceCallOptions and returns CallResult
- TwiML generates valid TTS response
- Phone numbers are validated before API call
- Twilio API errors are caught and logged
- Call SID is returned on successful call initiation
- Trial account limitations are handled gracefully

## Twilio Trial Limitations

- Can only call verified phone numbers
- Calls start with trial account message
- Limited to specific regions
