import '../setup.js';
import { describe, it, expect } from 'vitest';
import { validatePhoneNumber, generateTwiML } from '../../src/services/voiceService.js';

describe('voiceService', () => {
  describe('validatePhoneNumber', () => {
    it('should accept valid E.164 phone numbers', () => {
      expect(validatePhoneNumber('+14155551234')).toBe(true);
      expect(validatePhoneNumber('+84901234567')).toBe(true);
      expect(validatePhoneNumber('+442071234567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhoneNumber('4155551234')).toBe(false);
      expect(validatePhoneNumber('04155551234')).toBe(false);
      expect(validatePhoneNumber('+0155551234')).toBe(false);
      expect(validatePhoneNumber('')).toBe(false);
      expect(validatePhoneNumber('abc')).toBe(false);
    });
  });

  describe('generateTwiML', () => {
    it('should generate valid TwiML with message', () => {
      const twiml = generateTwiML('Hello World');
      expect(twiml).toContain('<?xml');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Say');
      expect(twiml).toContain('Hello World');
      expect(twiml).toContain('</Say>');
      expect(twiml).toContain('</Response>');
    });

    it('should include voice and language attributes', () => {
      const twiml = generateTwiML('Test', 'Polly.Joanna', 'en-US');
      expect(twiml).toContain('voice="Polly.Joanna"');
      expect(twiml).toContain('language="en-US"');
    });
  });
});
