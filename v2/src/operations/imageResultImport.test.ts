import { describe, expect, it } from 'vitest';
import { isHeicResultImage } from './imageResultImport';

describe('result image format detection', () => {
  it('recognizes HEIC and HEIF from their MIME types', () => {
    expect(isHeicResultImage({ name: 'upload', type: 'image/heic' })).toBe(true);
    expect(isHeicResultImage({ name: 'upload', type: 'image/heif-sequence' })).toBe(true);
  });

  it('recognizes iPhone images even when the browser omits the MIME type', () => {
    expect(isHeicResultImage({ name: 'IMG_0129.HEIC', type: '' })).toBe(true);
    expect(isHeicResultImage({ name: 'race-result.heif', type: 'application/octet-stream' })).toBe(true);
  });

  it('does not send common browser-readable formats through HEIC conversion', () => {
    expect(isHeicResultImage({ name: 'race-result.jpg', type: 'image/jpeg' })).toBe(false);
    expect(isHeicResultImage({ name: 'race-result.webp', type: 'image/webp' })).toBe(false);
  });
});
