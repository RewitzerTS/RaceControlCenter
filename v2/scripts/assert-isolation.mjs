import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const protectedRef = 'kjccstcbqygxuqkvdaqw';
const allowedRefFile = 'src/config/environment.ts';
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', '.git']);
const textExtensions = new Set(['.css', '.example', '.html', '.js', '.json', '.md', '.mjs', '.ts', '.tsx', '.yml', '.yaml']);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  }));
  return nested.flat();
}

const files = await collectFiles(root);
const violations = [];
let protectedRefOccurrences = 0;

for (const file of files) {
  const path = relative(root, file).replaceAll('\\\\', '/');
  const extension = path.includes('.env.example') ? '.example' : `.${path.split('.').pop()}`;
  if (!textExtensions.has(extension)) continue;

  const content = await readFile(file, 'utf8');
  const occurrences = content.split(protectedRef).length - 1;
  protectedRefOccurrences += occurrences;
  if (occurrences > 0 && path !== allowedRefFile && path !== 'scripts/assert-isolation.mjs') {
    violations.push(`${path}: contains the Production project reference`);
  }

  const privilegedCredential = ['service', 'role'].join('_');
  if (content.toLowerCase().includes(privilegedCredential)) {
    violations.push(`${path}: contains a privileged browser-forbidden credential name`);
  }
}

if (protectedRefOccurrences !== 2) {
  violations.push(`expected the protected project reference exactly twice (deny-list and isolation script), found ${protectedRefOccurrences}`);
}

if (violations.length > 0) {
  console.error('V2 isolation check failed:\n' + violations.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log('V2 isolation check passed. Production reference is deny-listed and no privileged browser credential is present.');
