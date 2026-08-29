import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = resolve(v2Root, '..', 'docs', 'v2', 'vora-deterministic-insights-300.json');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const insights = Array.isArray(catalog.insights) ? catalog.insights : [];
const categories = new Map();

for (const insight of insights) categories.set(insight.category, (categories.get(insight.category) || 0) + 1);

if (insights.length !== 300) throw new Error(`Expected 300 insights, found ${insights.length}.`);
if (new Set(insights.map((insight) => insight.id)).size !== 300) throw new Error('Insight IDs are not unique.');
if (categories.size !== 15 || [...categories.values()].some((count) => count !== 20)) {
  throw new Error(`Expected fifteen categories with 20 insights each, found ${JSON.stringify(Object.fromEntries(categories))}.`);
}
if (insights.some((insight) => !insight.title || !insight.body || !insight.focus || !insight.when?.all?.length)) {
  throw new Error('Every insight requires a title, body, focus, and deterministic conditions.');
}
if (insights.some((insight) => !insight.focus.startsWith('Dein nächster Fokus:'))) {
  throw new Error('Every insight must address the driver directly.');
}
const doubleEntendres = insights.filter((insight) => insight.voice === 'double_entendre').length;
if (doubleEntendres < 4 || doubleEntendres > 8) {
  throw new Error(`Double-entendre voice must stay rare, found ${doubleEntendres} of ${insights.length}.`);
}

console.log(`Vora catalog passed: ${insights.length} insights across ${categories.size} categories; ${doubleEntendres} rare double-entendre lines.`);
