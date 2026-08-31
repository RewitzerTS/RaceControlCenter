import { describe, expect, it } from 'vitest';
import { normalizeBrandingUrl } from './LeagueBrandingPage';

describe('normalizeBrandingUrl', () => {
  it('adds HTTPS to website and Discord addresses without a scheme', () => {
    expect(normalizeBrandingUrl('racevora.com', 'Website')).toBe('https://racevora.com/');
    expect(normalizeBrandingUrl('discord.gg/rcc', 'Discord')).toBe('https://discord.gg/rcc');
  });

  it('keeps valid HTTPS addresses and accepts an empty optional field', () => {
    expect(normalizeBrandingUrl('https://racevora.com/legal', 'Website')).toBe('https://racevora.com/legal');
    expect(normalizeBrandingUrl('   ', 'Website')).toBe('');
  });

  it('rejects non-web schemes and malformed addresses with a useful field name', () => {
    expect(() => normalizeBrandingUrl('ftp://racevora.com', 'Website')).toThrow(/Website/);
    expect(() => normalizeBrandingUrl('keine adresse', 'Discord')).toThrow(/Discord/);
  });
});
