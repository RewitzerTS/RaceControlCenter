import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [migration, page, client, shell, test] = await Promise.all([
  'supabase/migrations/20260820193000_v2_vora_context_service.sql',
  'src/vora/VoraPage.tsx', 'src/vora/vora.ts', 'src/components/AppShell.tsx',
  'supabase/tests/phase-20-vora.sql',
].map((path) => readFile(resolve(root, path), 'utf8')));
const violations = [];
for (const contract of ['get_vora_companion_snapshot', 'auth.uid()', 'platform_feature_flags', "'deterministic_v1'", 'context_fields', 'vora_context_audit_protect_history', 'revoke all on function', 'grant execute on function public.get_vora_companion_snapshot() to authenticated']) if (!migration.includes(contract)) violations.push('missing Vora data contract: ' + contract);
for (const forbidden of ['p_query', 'execute p_']) if (migration.toLowerCase().includes(forbidden)) violations.push('Vora received a forbidden free-query path: ' + forbidden);
for (const contract of ['loadVoraSnapshot', 'context_fields', 'deterministic_v1']) if (!client.includes(contract)) violations.push('missing Vora client contract: ' + contract);
for (const contract of ["t('vora.contextTitle')", 'snapshot.insight.title_key', 'CONTEXT_LABELS']) if (!page.includes(contract)) violations.push('missing Vora transparency contract: ' + contract);
if (!shell.includes('<VoraPage />')) violations.push('Vora route is not active');
for (const contract of ['rollback;', 'Vora leaked another driver career data', 'Vora ignored its server feature flag', 'Vora context audit was mutable']) if (!test.includes(contract)) violations.push('missing Vora SQL regression: ' + contract);
if (violations.length) { console.error('V2 Vora contract failed:\n' + violations.map((item) => '- ' + item).join('\n')); process.exit(1); }
console.log('V2 Phase 20 Vora contract passed: actor-bound controlled context, no free SQL, deterministic fallback, transparent provenance, feature gate, and immutable access audit are present.');
