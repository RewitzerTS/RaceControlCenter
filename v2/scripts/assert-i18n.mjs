import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const messagesPath = resolve(root, 'src/i18n/messages.ts');
const providerPath = resolve(root, 'src/i18n/I18nProvider.tsx');
const shellPath = resolve(root, 'src/components/AppShell.tsx');
const driverHomePath = resolve(root, 'src/driver/DriverHomePage.tsx');
const source = await readFile(messagesPath, 'utf8');
const provider = await readFile(providerPath, 'utf8');
const shell = await readFile(shellPath, 'utf8');
const driverHome = await readFile(driverHomePath, 'utf8');

const violations = [];
const expectedLocales = ['de', 'en', 'es', 'fr'];

if (!source.includes("export const SUPPORTED_LANGUAGES = ['de', 'en', 'es', 'fr'] as const")) {
  violations.push('launch locales are not exactly de, en, es, fr');
}

function keysFromBlock(block) {
  return [...block.matchAll(/^  (?:(\w+)|"([^"]+)"):/gm)]
    .map((match) => match[1] ?? match[2])
    .sort();
}

const blocks = {
  de: source.match(/const de = \{([\s\S]*?)\n\} as const;/)?.[1] ?? '',
  en: source.match(/\n  en: \{([\s\S]*?)\n\},\n  es:/)?.[1] ?? '',
  es: source.match(/\n  es: \{([\s\S]*?)\n\},\n  fr:/)?.[1] ?? '',
  fr: source.match(/\n  fr: \{([\s\S]*?)\n\},\n\};/)?.[1] ?? '',
};
const referenceKeys = keysFromBlock(blocks.de);
for (const locale of expectedLocales) {
  const localeKeys = keysFromBlock(blocks[locale]);
  if (JSON.stringify(localeKeys) !== JSON.stringify(referenceKeys)) {
    violations.push(`${locale} does not contain the complete Core translation key set`);
  }
}
for (const key of [
  'achievement.metric.title',
  'achievement.metric.description',
  'challenge.metric.title',
  'challenge.metric.description',
  'cosmetic.item.title',
  'cosmetic.item.description',
  'linkedRecord.one',
  'linkedRecord.other',
  'languageName.de',
  'languageName.en',
  'languageName.es',
  'languageName.fr',
]) {
  if (!referenceKeys.includes(key)) violations.push(`missing Core translation key: ${key}`);
}
for (const contract of [
  "const LOCALE_STORAGE_KEY = 'racevora.locale'",
  'globalThis.localStorage?.getItem',
  'navigator.languages',
  "return 'de'",
  'Intl.NumberFormat',
  'Intl.DateTimeFormat',
  'Intl.PluralRules',
  "document.documentElement.lang = language",
]) {
  if (!provider.includes(contract)) violations.push(`missing i18n runtime contract: ${contract}`);
}
for (const forbidden of [
  'Phase 13',
  'Project <code>',
  'Browser key only',
  'RLS remains authoritative',
  '<span>RaceVora V2</span>',
  'Append-only XP',
]) {
  if (shell.includes(forbidden)) violations.push(`hardcoded visible AppShell string remains: ${forbidden}`);
}
if (!driverHome.includes("t('home.greeting'") || !driverHome.includes("plural('home.achievementCount'")) {
  violations.push('Driver Home does not use interpolated and plural-aware translations');
}
for (const formatter of ['formatDate', 'formatTime', 'formatNumber']) {
  if (!driverHome.includes(formatter)) violations.push(`Driver Home does not use ${formatter}`);
}
if (violations.length) {
  console.error(`V2 i18n check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`V2 i18n check passed. ${referenceKeys.length} Core keys are complete in DE/EN/ES/FR with saved-choice precedence, German fallback, interpolation, plural, number, date, and time formatting.`);
