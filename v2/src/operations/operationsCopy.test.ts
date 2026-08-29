import { describe, expect, it } from 'vitest';
import { operationsCopyFor } from './operationsCopy';

describe('operations copy', () => {
  it('localizes the audited driver and result-import workflows', () => {
    expect(operationsCopyFor('en')('drivers.title')).toBe('Manage drivers');
    expect(operationsCopyFor('es')('import.selectImages')).toBe('Seleccionar imágenes de resultados');
    expect(operationsCopyFor('fr')('review.pointsMissing')).toBe('Points manquants');
  });

  it('interpolates dynamic review and progress values', () => {
    expect(operationsCopyFor('de')('review.rows', { count: 20 })).toBe('20 Zeilen');
    expect(operationsCopyFor('en')('import.prepared', { completed: 1, total: 2, file: 'spa.jpg' })).toContain('1 of 2');
  });
});
