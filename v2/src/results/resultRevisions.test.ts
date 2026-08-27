import { describe, expect, it } from 'vitest';
import { resultRevisionLabel, type ResultRevision } from './resultRevisions';

describe('result revision presentation', () => {
  it('identifies steward revisions without exposing internal vote details', () => {
    const revision = {
      resultVersionId: 'version-2', resultVersion: 2, resultStatus: 'active', changeReason: 'Steward decision RV-2026-0001 v1',
      activatedAt: '2026-08-25T12:00:00Z', isCurrent: true, stewardCaseNumber: 'RV-2026-0001', stewardDecisionVersion: 1,
      stewardOutcome: 'penalty', stewardFinalizedAt: '2026-08-25T12:00:00Z',
    } satisfies ResultRevision;

    expect(resultRevisionLabel(revision)).toBe('Steward-Revision · RV-2026-0001');
    expect(resultRevisionLabel({ ...revision, stewardCaseNumber: null })).toBeNull();
  });
});
