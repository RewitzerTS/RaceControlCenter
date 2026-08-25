import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasHeicResultImageSignature, isHeicResultImage, prepareRaceResultImages } from './imageResultImport';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it('uses the native bitmap decoder before the Image-element fallback', async () => {
    const close = vi.fn();
    const bitmap = { width: 1200, height: 600, close } as ImageBitmap;
    const createImageBitmap = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['prepared'], { type: 'image/jpeg' }));
    });

    const result = await prepareRaceResultImages([
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'IMG_0129.JPG', { type: 'image/jpeg' }),
    ]);

    expect(createImageBitmap).toHaveBeenCalledOnce();
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1200, 600);
    expect(close).toHaveBeenCalledOnce();
    expect(result[0]).toMatch(/^data:image\/jpeg;base64,/);
  });
});
