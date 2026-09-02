// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { assertProductionBindings, checkProductionBindings } from './production-bindings.mjs';

const production = {
  name: 'production', send_email: [{ name: 'FEEDBACK_EMAIL' }],
  ratelimits: [{ name: 'FEEDBACK_RATE_LIMIT', simple: { limit: 3, period: 60 } }, { name: 'FEEDBACK_GLOBAL_LIMIT', simple: { limit: 30, period: 60 } }],
};

describe('production deployment binding parity', () => {
  it('verifies the real repository configurations', async () => {
    await expect(checkProductionBindings(fileURLToPath(new URL('../', import.meta.url)))).resolves.toBeUndefined();
  });
  it('accepts matching bindings even though domain routes differ', () => {
    expect(() => assertProductionBindings(production, { ...production, routes: [{ pattern: 'example.com/*' }] })).not.toThrow();
  });
  it.each(['FEEDBACK_EMAIL', 'FEEDBACK_RATE_LIMIT', 'FEEDBACK_GLOBAL_LIMIT'])('rejects missing %s in the automatic deployment config', (name) => {
    const cutover = structuredClone(production);
    cutover.send_email = cutover.send_email.filter((binding) => binding.name !== name);
    cutover.ratelimits = cutover.ratelimits.filter((binding) => binding.name !== name);
    expect(() => assertProductionBindings(production, cutover)).toThrow(name);
  });
  it('rejects missing bindings in both configs rather than treating them as equivalent', () => {
    expect(() => assertProductionBindings({ name: 'production' }, { name: 'production' })).toThrow('FEEDBACK_EMAIL');
  });
  it('rejects different limits', () => {
    const cutover = structuredClone(production);
    cutover.ratelimits[0].simple.limit = 300;
    expect(() => assertProductionBindings(production, cutover)).toThrow('FEEDBACK_RATE_LIMIT');
  });
});
