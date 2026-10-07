import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import tracks from './trackCatalog.json';

it('every catalog track has a local RaceVora vector with real source vertices', () => {
  const source = JSON.parse(readFileSync('../assets/trackmaps/source/circuits.geojson', 'utf8'));
  const files = new Set(tracks.map((track) => track.trackMapFile));
  expect(files.size).toBe(25);
  for (const file of files) {
    expect(file).toMatch(/\.svg$/);
    const svg = readFileSync(`../assets/trackmaps/${file}`, 'utf8');
    expect(svg).toContain('stroke="url(#rv)"');
    expect(svg).not.toMatch(/<script|<image|<foreignObject|https?:\/\/(?!www.w3.org)/);
    const name = svg.match(/<title id="title">([^<]+)<\/title>/)?.[1];
    const feature = source.features.find((item: {properties: {Name: string}}) => item.properties.Name === name);
    expect(feature, file).toBeDefined();
    const path = svg.match(/<path id="circuit" d="([^"]+)"/)?.[1] ?? '';
    expect(path.match(/[ML]/g)?.length, file).toBe(feature.geometry.coordinates.length);
    expect(path.endsWith('Z')).toBe(true);
  }
  expect(tracks.find((track) => track.key === 'madrid')?.trackMapFile).toBe('madrid.svg');
  expect(tracks.find((track) => track.key === 'catalonia')?.trackMapFile).toBe('barcelona.svg');
});
