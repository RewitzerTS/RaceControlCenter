import { describe, expect, it } from 'vitest';
import { buildGraphicModel, digestGraphicSource, graphicFilename, paginateGraphicModel, type GraphicLabels, type GraphicsWorkspace } from './graphics';
import { GRAPHIC_DIMENSIONS, mixGraphicColors, resolveRaceResultPortraitTemplate, type GraphicTheme } from './renderPng';

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

  it('builds every race-bound graphic from the selected official result', () => {
    const selectedWorkspace: GraphicsWorkspace = {
      ...workspace,
      latest_result: {
        ...workspace.latest_result!,
        id: 'result-v1',
        version: 1,
        race_id: 'race-canada',
        race_name: 'Canadian Grand Prix',
        circuit: 'Circuit Gilles Villeneuve',
        round: 1,
      },
    };
    const model = buildGraphicModel(selectedWorkspace, 'race_result', labels);
    expect(model.resultVersionId).toBe('result-v1');
    expect(model.title).toBe('Canadian Grand Prix');
    expect(model.subtitle).toBe('Circuit Gilles Villeneuve');
  });

  it('keeps standings global to the structured standings snapshot, without a result binding', () => {
    const model = buildGraphicModel(workspace, 'driver_standings', labels);
    expect(model.resultVersionId).toBeNull();
    expect(model.rows[0]).toMatchObject({ primary: 'Alex Apex', value: '88 pts' });
  });

  it('creates a stable SHA-256 source digest and versioned filename', async () => {
    const model = buildGraphicModel(workspace, 'winner', labels);
    const digest = await digestGraphicSource(model, 'story');
    const presentedDigest = await digestGraphicSource(model, 'story', { branding: { name: 'RaceVora Demo' }, theme: { primary: '#7653C7' } });
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(presentedDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(presentedDigest).not.toBe(digest);
    expect(graphicFilename(workspace, 'winner', 'story')).toBe('racevora-demo-winner-story-v2.png');
    expect(graphicFilename(workspace, 'race_result', 'portrait', 2, 2)).toBe('racevora-demo-race_result-portrait-v2-02.png');
  });

  it('balances complete race results across pages of at most eleven drivers', () => {
    const model = buildGraphicModel(workspace, 'race_result', labels);
    const rows = Array.from({ length: 20 }, (_, index) => ({ ...model.rows[0], rank: String(index + 1), primary: `Driver ${index + 1}` }));
    const pages = paginateGraphicModel({ ...model, rows }, 11);
    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.model.rows.length)).toEqual([10, 10]);
    expect(pages.flatMap((page) => page.model.rows).map((row) => row.primary)).toEqual(rows.map((row) => row.primary));
    expect(pages[0]?.model.rows.at(-1)).toMatchObject({ rank: '10', primary: 'Driver 10' });
    expect(pages[1]?.model.rows.at(-1)).toMatchObject({ rank: '20', primary: 'Driver 20' });

    const twentyTwo = paginateGraphicModel({ ...model, rows: [...rows, ...rows.slice(0, 2)] }, 11);
    expect(twentyTwo.map((page) => page.model.rows.length)).toEqual([11, 11]);
  });

  it('injects the active theme into the editable portrait pilot template', () => {
    const theme: GraphicTheme = {
      background: '#010203', surface: '#111213', surfaceAlt: '#212223', primary: '#313233', secondary: '#414243',
      accent: '#515253', text: '#F1F2F3', muted: '#A1A2A3', line: '#616263', onPrimary: '#717273',
    };
    const svg = resolveRaceResultPortraitTemplate(theme);
    expect(svg).toContain('data-rv-template="race-result-portrait"');
    expect(svg).toContain('id="slot-table"');
    expect(svg).toContain(theme.primary);
    expect(svg).not.toContain('var(--rv-primary)');
    expect(mixGraphicColors('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });

  it('uses exact export dimensions for all four formats', () => {
    expect(GRAPHIC_DIMENSIONS).toEqual({ square: { width: 1080, height: 1080 }, portrait: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 }, landscape: { width: 1920, height: 1080 } });
  });
});
