import { describe, expect, it } from 'vitest';
import { authErrorFeedbackKey } from './BetaAccessPage';

describe('authErrorFeedbackKey', () => {
  it('uses a safe shared message for unknown accounts and wrong passwords', () => {
    expect(authErrorFeedbackKey('sign-in', { code: 'invalid_credentials' })).toBe('beta.signInInvalid');
    expect(authErrorFeedbackKey('sign-in', { code: 'user_not_found' })).toBe('beta.signInInvalid');
  });

  it('explains confirmation and rate-limit errors', () => {
    expect(authErrorFeedbackKey('sign-in', { code: 'email_not_confirmed' })).toBe('beta.emailNotConfirmed');
    expect(authErrorFeedbackKey('recovery', { code: 'over_email_send_rate_limit' })).toBe('beta.rateLimited');
    expect(authErrorFeedbackKey('sign-in', { code: 'captcha_failed' })).toBe('beta.captchaFailed');
  });

  it('keeps generic technical errors specific to the attempted flow', () => {
    expect(authErrorFeedbackKey('sign-in', new Error('network'))).toBe('beta.signInError');
    expect(authErrorFeedbackKey('sign-up', { code: 'weak_password' })).toBe('beta.signUpError');
    expect(authErrorFeedbackKey('recovery', new Error('network'))).toBe('beta.recoveryError');
  });
});
