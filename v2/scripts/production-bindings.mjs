import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Both configs deploy the SAME Worker. Missing bindings remove them at deployment.
export function assertProductionBindings(production, cutover) {
  assert.equal(production.name, cutover.name, 'Production configs must target the same Worker');
  for (const [field, name] of [['send_email', 'FEEDBACK_EMAIL'], ['ratelimits', 'FEEDBACK_RATE_LIMIT'], ['ratelimits', 'FEEDBACK_GLOBAL_LIMIT']]) {
    const expected = production[field]?.find((binding) => binding.name === name);
    const actual = cutover[field]?.find((binding) => binding.name === name);
    assert.ok(expected, `Missing ${name} in wrangler.production.jsonc`);
    assert.deepEqual(actual, expected, `Binding ${name} must match in both production configs`);
  }
}

export async function checkProductionBindings(root) {
  const [production, cutover] = await Promise.all(['wrangler.production.jsonc', 'wrangler.cutover.jsonc'].map(async (name) => JSON.parse(await readFile(resolve(root, name), 'utf8'))));
  assertProductionBindings(production, cutover);
}
