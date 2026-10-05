import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import venues from './venueMedia.json';
import catalog from '../racing/trackCatalog.json';

describe('generated race-card artwork', () => {
  it('maps every F1 25/26 catalog entry exactly once', () => {
    const keys = venues.flatMap(venue => venue.keys);
    expect(keys.length).toBe(new Set(keys).size);
    expect([...keys].sort()).toEqual(catalog.map(track => track.key).sort());
    expect(venues).toHaveLength(25);
    expect(venues.find(venue => venue.keys.includes('spain'))?.keys).toContain('catalonia');
  });
  it('ships all illustrations as bounded-size genuine WebP files, without stale photo attribution', () => {
    for (const venue of venues) {
      expect(venue.generated).toBe(true);
      expect(venue).not.toHaveProperty('author');
      expect(venue).not.toHaveProperty('license');
      expect(venue.src).toMatch(/^\/assets\/race-art\/20261006\/[a-z0-9-]+\.webp$/);
      const file = resolve(process.cwd(), 'public', venue.src.slice(1));
      const bytes = readFileSync(file);
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
      expect(statSync(file).size).toBeLessThan(550_000);
    }
  });
});
