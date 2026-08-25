import { describe, expect, it } from 'vitest';
import { hasHeicResultImageSignature, isHeicResultImage } from './imageResultImport';

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

  it('recognizes HEIC from the file signature when name and MIME type are missing or wrong', async () => {
    const heicHeader = new Uint8Array([
      0x00, 0x00, 0x00, 0x18,
      0x66, 0x74, 0x79, 0x70,
      0x68, 0x65, 0x69, 0x63,
      0x00, 0x00, 0x00, 0x00,
      0x6d, 0x69, 0x66, 0x31,
    ]);
    expect(await hasHeicResultImageSignature(new Blob([heicHeader], { type: 'application/octet-stream' }))).toBe(true);
  });

  it('does not mistake a regular JPEG signature for HEIC', async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    expect(await hasHeicResultImageSignature(new Blob([jpegHeader], { type: 'image/jpeg' }))).toBe(false);
  });
});
