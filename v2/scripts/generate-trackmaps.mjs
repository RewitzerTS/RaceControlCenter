// Reproducible SVG geometry, not generated/imagined circuit illustrations.
// Run with --fetch once to refresh the pinned, MIT-licensed coordinate source.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sourceDir = resolve(root, 'assets/trackmaps/source');
const revision = '394d8fbe70ef2c0b0c8d23ff7bee61fa09606055';
const base = `https://raw.githubusercontent.com/bacinger/f1-circuits/${revision}`;
const mapping = {
  australia: 'au-1953', bahrain: 'bh-2002', shanghai: 'cn-2004', barcelona: 'es-1991',
  monaco: 'mc-1929', montreal: 'ca-1978', redbullring: 'at-1969', silverstone: 'gb-1948',
  hungaroring: 'hu-1986', spa: 'be-1925', monza: 'it-1922', singapore: 'sg-2008',
  suzuka: 'jp-1962', cota: 'us-2012', mexico: 'mx-1962', interlagos: 'br-1940',
  abudhabi: 'ae-2009', imola: 'it-1953', zandvoort: 'nl-1948', jeddah: 'sa-2021',
  miami: 'us-2022', qatar: 'qa-2004', madrid: 'es-2026', baku: 'az-2016', vegas: 'us-2023',
};
await mkdir(sourceDir, { recursive: true });
if (process.argv.includes('--fetch')) {
  const [response, licenseResponse] = await Promise.all([fetch(`${base}/f1-circuits.geojson`), fetch(`${base}/LICENSE.md`)]);
  if (!response.ok || !licenseResponse.ok) throw new Error('Coordinate source unavailable');
  const data = await response.json();
  const license = await licenseResponse.text();
  if (!license.includes('Permission is hereby granted, free of charge')) throw new Error('Review changed license');
  const features = data.features.filter((entry) => Object.values(mapping).includes(entry.properties.id));
  if (features.length !== Object.keys(mapping).length) throw new Error('Missing circuit geometry');
  await writeFile(resolve(sourceDir, 'circuits.geojson'), JSON.stringify({ type: 'FeatureCollection', source: base, features }) + '\n');
  await writeFile(resolve(root, 'assets/trackmaps/LICENSE.txt'), license);
}
const data = JSON.parse(await readFile(resolve(sourceDir, 'circuits.geojson'), 'utf8'));
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
for (const [file, id] of Object.entries(mapping)) {
  const feature = data.features.find((entry) => entry.properties.id === id);
  if (!feature || feature.geometry.type !== 'LineString') throw new Error(`Invalid circuit ${id}`);
  const points = feature.geometry.coordinates;
  if (points.length < 60 || points.some((p) => p.length !== 2 || p.some((n) => !Number.isFinite(n)))) throw new Error(`Incomplete geometry ${id}`);
  // Local equirectangular projection; preserve every source vertex. A single
  // rotation and uniform scale fit the circuit, never independent X/Y stretching.
  const lon = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const projected = points.map(([x, y]) => [(x - lon) * Math.cos(lat * Math.PI / 180), -(y - lat)]);
  const xx = projected.reduce((sum, [x]) => sum + x * x, 0);
  const yy = projected.reduce((sum, [, y]) => sum + y * y, 0);
  const xy = projected.reduce((sum, [x, y]) => sum + x * y, 0);
  const angle = -.5 * Math.atan2(2 * xy, xx - yy);
  const rotated = projected.map(([x, y]) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]);
  const minX = Math.min(...rotated.map((p) => p[0])), maxX = Math.max(...rotated.map((p) => p[0]));
  const minY = Math.min(...rotated.map((p) => p[1])), maxY = Math.max(...rotated.map((p) => p[1]));
  const width = 1000, padding = 28, scale = (width - 2 * padding) / (maxX - minX);
  const height = (maxY - minY) * scale + 2 * padding;
  const path = rotated.map(([x, y], i) => `${i ? 'L' : 'M'}${((x - minX) * scale + padding).toFixed(3)} ${((y - minY) * scale + padding).toFixed(3)}`).join(' ') + 'Z';
  const name = escape(feature.properties.Name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height.toFixed(3)}" role="img" aria-labelledby="title desc">
<title id="title">${name}</title>
<desc id="desc">RaceVora circuit outline. Geometry: Tomislav Bacinger, MIT, ${revision}. All source vertices preserved; geographic projection, rotation and uniform scaling only. Colors are branding, not sector boundaries.</desc>
<style>@media(max-width:240px){.casing{stroke-width:24}.route{stroke-width:14}}</style>
<defs><linearGradient id="rv" x1="0" y1="0" x2="1" y2=".6"><stop stop-color="#35e4db"/><stop offset=".5" stop-color="#529bff"/><stop offset="1" stop-color="#ac80ff"/></linearGradient><path id="circuit" d="${path}"/></defs>
<use class="casing" href="#circuit" fill="none" stroke="#07121e" stroke-width="15" stroke-linejoin="round" stroke-linecap="round"/>
<use class="route" href="#circuit" fill="none" stroke="url(#rv)" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
</svg>\n`;
  await writeFile(resolve(root, `assets/trackmaps/${file}.svg`), svg);
}
console.log(`Generated ${Object.keys(mapping).length} precise RaceVora vector maps.`);
