import { describe, expect, it, vi } from 'vitest';
import worker from './news-worker.js';

describe('RaceVora domain routing', () => {
  it('redirects every www request to the canonical landing page', async () => {
    const assetsFetch = vi.fn();
    const response = await worker.fetch(
      new Request('https://www.racevora.com/profile?from=bookmark'),
      { ASSETS: { fetch: assetsFetch } },
      { waitUntil: vi.fn() },
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://racevora.com/');
    expect(assetsFetch).not.toHaveBeenCalled();
  });

  it('serves the canonical root from the landing asset', async () => {
    const assetsFetch = vi.fn(async (request) => new Response(new URL(request.url).pathname));
    const response = await worker.fetch(
      new Request('https://racevora.com/'),
      { ASSETS: { fetch: assetsFetch } },
      { waitUntil: vi.fn() },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('/landing');
  });
});

