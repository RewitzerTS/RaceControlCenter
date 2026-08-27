import { describe, expect, it } from 'vitest';
import { notificationPresentation } from './notificationPresentation';

describe('notification presentation', () => {
  it('routes safe result metadata to the official racing view', () => {
    const result = notificationPresentation({
      id: 'n1', notification_kind: 'race_summary', title_key: 'notification.resultRevised.title',
      body_key: 'notification.resultRevised.body', payload: { race_name: 'Australien GP', result_version: 3 },
      created_at: '2026-08-26T00:00:00Z', read_at: null,
    });
    expect(result).toMatchObject({ categoryKey: 'notification.kind.result', reference: 'V3', target: '/racing' });
    expect(result.params).toEqual({ race: 'Australien GP', caseNumber: '—', version: 3 });
  });

  it('shows the public case reference but no vote or evidence detail', () => {
    const result = notificationPresentation({
      id: 'n2', notification_kind: 'steward_decision', title_key: 'notification.stewardDecision.title',
      body_key: 'notification.stewardDecision.body', payload: { case_number: 'RV-2026-0001', race_name: 'Australien GP' },
      created_at: '2026-08-26T00:00:00Z', read_at: null,
    });
    expect(result).toMatchObject({ categoryKey: 'notification.kind.steward', reference: 'RV-2026-0001', target: '/racing' });
    expect(result.params).not.toHaveProperty('reasoning');
    expect(result.params).not.toHaveProperty('votes');
  });
});
