import { describe, expect, it } from 'vitest';
import { isAccountDeletionConfirmed } from './accountDeletion';

describe('account deletion confirmation', () => {
  it('requires the complete account email address', () => {
    expect(isAccountDeletionConfirmed('driver@example.com', 'driver@example.com')).toBe(true);
    expect(isAccountDeletionConfirmed('driver', 'driver@example.com')).toBe(false);
  });

  it('normalizes casing and surrounding whitespace', () => {
    expect(isAccountDeletionConfirmed('  DRIVER@EXAMPLE.COM ', 'driver@example.com')).toBe(true);
  });

  it('cannot confirm an account without an email address', () => {
    expect(isAccountDeletionConfirmed('', null)).toBe(false);
  });
});
