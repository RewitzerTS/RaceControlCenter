import { describe, expect, it } from 'vitest';
import { buildGraphicModel, digestGraphicSource, formatRaceGap, graphicArchiveFilename, graphicFilename, paginateGraphicModel, type GraphicLabels, type GraphicsWorkspace } from './graphics';
import { createGraphicZip } from './downloadGraphics';
import { GRAPHIC_DIMENSIONS, leagueInitials, leagueWatermarkOpacity, mixGraphicColors, resolvePilotRowTextSizes, resolvePilotTableFrame, resolveRaceResultPortraitTemplate, type GraphicTheme } from './renderPng';

const labels: GraphicLabels = {
  raceResult: 'Race Result', podium: 'Podium', winner: 'Winner', driverStandings: 'Driver Standings', teamStandings: 'Team Standings', achievement: 'Achievement',
  points: 'pts', time: 'Time', wins: 'wins', round: 'Round', resultVersion: 'Result version', official: 'Official data', noData: 'No data',
};

const workspace: GraphicsWorkspace = {
  league: { id: 'league-1', name: 'RaceVora Demo', slug: 'demo' },
  latest_result: {
    id: 'result-v2', version: 2, race_id: 'race-1', race_name: 'Belgian Grand Prix', circuit: 'Spa-Francorchamps', country_code: 'BE', race_date: '2026-08-20', round: 7,
    rows: [
      { position: 1, driverId: 'driver-1', driver: 'Alex Apex', team: 'Vora Racing', points: 25, status: 'classified', raceTime: '42:13,500', raceTimeMs: 2533500 },
      { position: 2, driverId: 'driver-2', driver: 'Sam Slipstream', team: 'Vector Motorsport', points: 18, status: 'classified', raceTimeMs: 2606494 },
      { position: 3, driverId: 'driver-3', driver: 'Jordan Grid', team: 'Vora Racing', points: 15, status: 'classified', raceTime: 'DNF' },
    ],
  },
  driver_labels: [
    { driverId: 'driver-1', driverName: 'Alexander Apex', displayName: 'Alex Apex', gamertag: 'xApex' },
    { driverId: 'driver-2', displayName: 'Sam Slipstream', gamertag: 'SlipSam' },
    { driverId: 'driver-3', displayName: 'Jordan Grid' },
  ],
  driver_standings: [{ position: 1, driverId: 'driver-1', driver: 'Alex Apex', points: 88, wins: 3 }],
  team_standings: [{ position: 1, team: 'Vora Racing', points: 140, wins: 4 }],
  latest_achievement: { driverId: 'driver-1', driver: 'Alex Apex', code: 'wins_3', value: 3, unlocked_at: '2026-08-20T18:00:00Z' },
  recent_renders: [],
};

describe('Social Graphics model', () => {
  it('derives the watermark fallback from the active league name', () => {
    expect(leagueInitials('RummelRacer')).toBe('RUM');
    expect(leagueInitials('Race Union Munich')).toBe('RUM');
    expect(leagueInitials('')).toBe('RV');
    expect(leagueWatermarkOpacity(true)).toBe(1);
    expect(leagueWatermarkOpacity(false)).toBe(0.09);
  });

  it('renders race times at the same metric size as points in every format', () => {
    [0.94, 1, 1.02, 1.16].forEach((scale) => {
      const raceResult = resolvePilotRowTextSizes(48, scale, false, true);
      const standings = resolvePilotRowTextSizes(48, scale, false, false);

      expect(raceResult.detail).toBe(raceResult.value);
      expect(raceResult.detail).toBeGreaterThan(raceResult.secondary);
      expect(raceResult.team).toBe(raceResult.primary);
      expect(standings.detail).toBe(standings.secondary);
    });
  });

  it('binds result graphics to the exact official result version', () => {
    const model = buildGraphicModel(workspace, 'podium', labels);
    expect(model.resultVersionId).toBe('result-v2');
    expect(model.rows.map((row) => row.primary)).toEqual(['Alexander Apex', 'Sam Slipstream', 'Jordan Grid']);
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
    expect(model.rows[0]?.detail).toBe('42:13,500');
    expect(model.rows[1]?.detail).toBe('+01:12.994');
    expect(model.rows[2]?.detail).toBe('DNF');
    expect(model.source.result).toMatchObject({ country_code: 'BE' });
  });

  it('formats official race gaps with minutes, seconds and milliseconds', () => {
    expect(formatRaceGap(3294)).toBe('+00:03.294');
    expect(formatRaceGap(72994)).toBe('+01:12.994');
  });

  it('keeps standings global to the structured standings snapshot, without a result binding', () => {
    const model = buildGraphicModel(workspace, 'driver_standings', labels);
    expect(model.resultVersionId).toBeNull();
    expect(model.rows[0]).toMatchObject({ primary: 'Alexander Apex', value: '88 pts' });
  });

  it('switches every driver graphic between driver name, display name and gamertag', () => {
    expect(buildGraphicModel(workspace, 'race_result', labels, 'driver_name').rows[0]?.primary).toBe('Alexander Apex');
    expect(buildGraphicModel(workspace, 'podium', labels, 'display_name').rows[0]?.primary).toBe('Alex Apex');
    expect(buildGraphicModel(workspace, 'winner', labels, 'gamertag').title).toBe('xApex');
    expect(buildGraphicModel(workspace, 'driver_standings', labels, 'gamertag').rows[0]?.primary).toBe('xApex');
    expect(buildGraphicModel(workspace, 'achievement', labels, 'driver_name').title).toBe('Alexander Apex');
  });

  it('resolves every driver label mode without embedded driver ids', () => {
    const withoutEmbeddedIds: GraphicsWorkspace = {
      ...workspace,
      driver_labels: workspace.driver_labels?.map((entry) => ({ ...entry, leagueDriverName: entry.displayName })),
      driver_standings: [{ position: 1, driver: 'Alex Apex', points: 88, wins: 3 }],
      latest_achievement: { driver: 'Alex Apex', code: 'wins_3', value: 3, unlocked_at: '2026-08-20T18:00:00Z' },
    };
    expect(buildGraphicModel(withoutEmbeddedIds, 'driver_standings', labels, 'gamertag').rows[0]?.primary).toBe('xApex');
    expect(buildGraphicModel(withoutEmbeddedIds, 'achievement', labels, 'driver_name').title).toBe('Alexander Apex');
  });

  it('falls back to the available display name when a driver label is missing', () => {
    expect(buildGraphicModel(workspace, 'race_result', labels, 'driver_name').rows[1]?.primary).toBe('Sam Slipstream');
    expect(buildGraphicModel(workspace, 'race_result', labels, 'gamertag').rows[2]?.primary).toBe('Jordan Grid');
  });

  it('creates a stable SHA-256 source digest and versioned filename', async () => {
    const model = buildGraphicModel(workspace, 'winner', labels);
    const gamertagModel = buildGraphicModel(workspace, 'winner', labels, 'gamertag');
    const digest = await digestGraphicSource(model, 'story');
    const gamertagDigest = await digestGraphicSource(gamertagModel, 'story');
    const presentedDigest = await digestGraphicSource(model, 'story', { branding: { name: 'RaceVora Demo' }, theme: { primary: '#7653C7' } });
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(presentedDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(presentedDigest).not.toBe(digest);
    expect(gamertagDigest).not.toBe(digest);
    expect(graphicFilename(workspace, 'winner', 'story')).toBe('racevora-demo-winner-story-v2.png');
    expect(graphicFilename(workspace, 'race_result', 'portrait', 2, 2)).toBe('racevora-demo-race_result-portrait-v2-02.png');
    expect(graphicArchiveFilename(workspace, 'race_result', 'landscape')).toBe('racevora-demo-race_result-landscape-v2.zip');
  });

  it('packages every generated PNG into one repeatable ZIP download', async () => {
    const archive = await createGraphicZip([
      { filename: 'page-01.png', blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) },
      { filename: 'page-02.png', blob: new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' }) },
    ]);
    const bytes = new Uint8Array(await archive.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    expect(archive.type).toBe('application/zip');
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(0x04034b50);
    expect(text).toContain('page-01.png');
    expect(text).toContain('page-02.png');
    expect(new DataView(bytes.buffer).getUint32(bytes.length - 22, true)).toBe(0x06054b50);
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

  it('centers a compact 4:3 table frame in landscape without shrinking other formats', () => {
    expect(resolvePilotTableFrame('landscape')).toEqual({ left: 240, right: 1680, width: 1440 });
    expect(resolvePilotTableFrame('square')).toEqual({ left: 36, right: 1044, width: 1008 });
    expect(resolvePilotTableFrame('portrait')).toEqual({ left: 36, right: 1044, width: 1008 });
    expect(resolvePilotTableFrame('story')).toEqual({ left: 48, right: 1032, width: 984 });
  });
});
