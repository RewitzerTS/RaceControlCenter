import { describe, expect, it } from 'vitest';
import { buildGraphicModel, digestGraphicSource, graphicFilename, type GraphicLabels, type GraphicsWorkspace } from './graphics';
import { GRAPHIC_DIMENSIONS } from './renderPng';

const labels: GraphicLabels = {
  raceResult: 'Race Result', podium: 'Podium', winner: 'Winner', driverStandings: 'Driver Standings', teamStandings: 'Team Standings', achievement: 'Achievement',
  points: 'pts', wins: 'wins', round: 'Round', resultVersion: 'Result version', official: 'Official data', noData: 'No data',
};

const workspace: GraphicsWorkspace = {
  league: { id: 'league-1', name: 'RaceVora Demo', slug: 'demo' },
  latest_result: {
    id: 'result-v2', version: 2, race_id: 'race-1', race_name: 'Belgian Grand Prix', circuit: 'Spa-Francorchamps', race_date: '2026-08-20', round: 7,
    rows: [
      { position: 1, driver: 'Alex Apex', team: 'Vora Racing', points: 25, status: 'classified' },
      { position: 2, driver: 'Sam Slipstream', team: 'Vector Motorsport', points: 18, status: 'classified' },
      { position: 3, driver: 'Jordan Grid', team: 'Vora Racing', points: 15, status: 'classified' },
    ],
  },
  driver_standings: [{ position: 1, driver: 'Alex Apex', points: 88, wins: 3 }],
  team_standings: [{ position: 1, team: 'Vora Racing', points: 140, wins: 4 }],
  latest_achievement: { driver: 'Alex Apex', code: 'wins_3', value: 3, unlocked_at: '2026-08-20T18:00:00Z' },
  recent_renders: [],
};

describe('Social Graphics model', () => {
  it('binds result graphics to the exact official result version', () => {
    const model = buildGraphicModel(workspace, 'podium', labels);
    expect(model.resultVersionId).toBe('result-v2');
    expect(model.rows.map((row) => row.primary)).toEqual(['Alex Apex', 'Sam Slipstream', 'Jordan Grid']);
    expect(model.footer).toContain('2');
  });

  it('keeps standings global to the structured standings snapshot, without a result binding', () => {
    const model = buildGraphicModel(workspace, 'driver_standings', labels);
    expect(model.resultVersionId).toBeNull();
    expect(model.rows[0]).toMatchObject({ primary: 'Alex Apex', value: '88 pts' });
  });

  it('creates a stable SHA-256 source digest and versioned filename', async () => {
    const model = buildGraphicModel(workspace, 'winner', labels);
    await expect(digestGraphicSource(model, 'story')).resolves.toMatch(/^[0-9a-f]{64}$/);
    expect(graphicFilename(workspace, 'winner', 'story')).toBe('racevora-demo-winner-story-v2.png');
  });

  it('uses exact launch dimensions for all three formats', () => {
    expect(GRAPHIC_DIMENSIONS).toEqual({ square: { width: 1080, height: 1080 }, portrait: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 } });
  });
});
