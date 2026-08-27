// @ts-nocheck -- Vitest executes browser scripts in Node without shipping Node types to the client bundle.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadRccData() {
  const context = { window: {} };
  const source = readFileSync(resolve(process.cwd(), '..', 'assets/js/services/rcc-data.js'), 'utf8');
  vm.runInNewContext(source, context, { filename: 'rcc-data.js' });
  return context.window.RCCData;
}

describe('public season archive', () => {
  it('keeps only the official current result version for every archived race', () => {
    const data = loadRccData();
    const races = [
      { id: 'race-1', current_result_version_id: 'version-2' },
      { id: 'race-2', current_result_version_id: 'version-3' },
      { id: 'race-3', current_result_version_id: null },
    ];
    const results = [
      { id: 'old', race_id: 'race-1', result_version_id: 'version-1' },
      { id: 'current-1', race_id: 'race-1', result_version_id: 'version-2' },
      { id: 'current-2', race_id: 'race-2', result_version_id: 'version-3' },
      { id: 'draft', race_id: 'race-3', result_version_id: 'version-4' },
    ];

    expect(data.filterCurrentRaceResults(races, results).map((row) => row.id)).toEqual(['current-1', 'current-2']);
  });

  it('requests archived results with explicit race and result-version filters', () => {
    const source = readFileSync(resolve(process.cwd(), '..', 'assets/js/pages/season-archive.js'), 'utf8');
    expect(source).toContain('fetchRaceResults({ raceIds, resultVersionIds })');
    expect(source).not.toContain('fetchRaceResults()');
    expect(source).toContain("target.searchParams.set('view', 'seasons')");
  });

  it('opens archived race details with only their official result version', () => {
    const source = readFileSync(resolve(process.cwd(), '..', 'assets/js/pages/race-detail.js'), 'utf8');
    expect(source).toContain('resultVersionIds: [race.current_result_version_id]');
    expect(source).toContain('Promise.resolve([])');
  });
});
