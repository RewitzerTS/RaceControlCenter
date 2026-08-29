import type { AiResultAnalysis, AiResultRow } from './imageResultImport';
import type { ImportedResultRow, LeagueDriver } from './operations';
import { operationsCopyFor, useOperationsCopy, type OperationsCopy } from './operationsCopy';
import { parseFastestLapToMs } from './resultCsv';

type MatchSource = 'driverName' | 'gamertag' | 'manual' | 'similar' | 'unassigned';

export type ResultReviewRow = {
  key: string;
  driverId: string;
  rawDriver: string;
  matchSource: MatchSource;
  confidence: number;
  finishPosition: string;
  gridPosition: string;
  pitStops: string;
  fastestLap: string;
  raceTime: string;
  points: string;
  teamName: string;
  carName: string;
};

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function findDriverMatch(rawName: string, drivers: LeagueDriver[]): { driver: LeagueDriver; source: MatchSource } | null {
  const raw = normalize(rawName);
  if (!raw) return null;
  for (const driver of drivers) {
    if (normalize(driver.gamertag) === raw) return { driver, source: 'gamertag' };
    if (normalize(driver.display_name) === raw) return { driver, source: 'driverName' };
  }
  const candidates = drivers.filter((driver) => {
    const values = [normalize(driver.gamertag), normalize(driver.display_name)].filter((value) => value.length >= 4);
    return values.some((value) => value.includes(raw) || raw.includes(value));
  });
  return candidates.length === 1 ? { driver: candidates[0], source: 'similar' } : null;
}

function toField(value: number | string | null | undefined): string {
  return value == null ? '' : String(value);
}

export function buildResultReviewRows(analysis: AiResultAnalysis, drivers: LeagueDriver[]): ResultReviewRow[] {
  return analysis.rows
    .filter((row) => row.driver.trim())
    .sort((left, right) => Number(left.position ?? 999) - Number(right.position ?? 999))
    .map((row: AiResultRow, index) => {
      const match = findDriverMatch(row.driver, drivers);
      return {
        key: `${index}-${normalize(row.driver) || 'driver'}`,
        driverId: match?.driver.id ?? '',
        rawDriver: row.driver.trim(),
        matchSource: match?.source ?? 'unassigned',
        confidence: Math.max(0, Math.min(1, Number(row.confidence) || 0)),
        finishPosition: toField(row.position),
        gridPosition: toField(row.grid_position),
        pitStops: toField(row.pit_stops ?? 0),
        fastestLap: row.fastest_lap?.trim() ?? '',
        raceTime: row.race_time?.trim() ?? '',
        points: '',
        teamName: match?.driver.league_team?.trim() || row.team?.trim() || '',
        carName: match?.driver.car_name?.trim() || '',
      };
    });
}

function requireInteger(value: string, label: string, minimum: number, copy: OperationsCopy): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) throw new Error(copy('review.integerError', { field: label, minimum }));
  return parsed;
}

export function resultReviewRowsToImported(rows: ResultReviewRow[], drivers: LeagueDriver[], copy: OperationsCopy = operationsCopyFor('de')): ImportedResultRow[] {
  if (!rows.length) throw new Error(copy('review.emptyError'));
  const driverIds = rows.map((row) => row.driverId);
  if (driverIds.some((id) => !id)) throw new Error(copy('review.assignAllError'));
  if (new Set(driverIds).size !== driverIds.length) throw new Error(copy('review.duplicateDriverError'));
  const finishPositions = rows.map((row) => requireInteger(row.finishPosition, copy('review.finishPosition'), 1, copy));
  if (new Set(finishPositions).size !== finishPositions.length) throw new Error(copy('review.duplicateFinishError'));

  return rows.map((row, index) => {
    const driver = drivers.find((candidate) => candidate.id === row.driverId);
    if (!driver) throw new Error(copy('review.driverUnavailableError', { row: index + 1 }));
    const points = Number(row.points.replace(',', '.'));
    if (!row.points.trim() || !Number.isFinite(points) || points < 0) throw new Error(copy('review.pointsError', { row: index + 1 }));
    const fastestLapMs = row.fastestLap ? parseFastestLapToMs(row.fastestLap) : undefined;
    if (row.fastestLap && fastestLapMs === undefined) throw new Error(copy('review.fastestLapError', { row: index + 1 }));
    return {
      driver_id: driver.id,
      driver_name: driver.display_name,
      finish_position: finishPositions[index],
      grid_position: row.gridPosition ? requireInteger(row.gridPosition, copy('review.startPosition'), 1, copy) : undefined,
      pit_stops: requireInteger(row.pitStops || '0', copy('review.stops'), 0, copy),
      points,
      team_name: row.teamName.trim() || undefined,
      car_name: row.carName.trim() || undefined,
      fastest_lap_time: row.fastestLap.trim() || undefined,
      fastest_lap_time_ms: fastestLapMs,
      race_time: row.raceTime.trim() || undefined,
    };
  });
}

export function reviewRowsReady(rows: ResultReviewRow[]): boolean {
  return rows.length > 0 && rows.every((row) => row.driverId && row.finishPosition && row.points.trim());
}

function confidencePresentation(row: ResultReviewRow) {
  const confidence = Math.round(row.confidence * 100);
  return { confidence, confidenceLevel: confidence >= 85 ? 'high' : confidence >= 65 ? 'medium' : 'low' };
}

export function ResultImportReviewTable({ rows, drivers, onChange }: {
  rows: ResultReviewRow[];
  drivers: LeagueDriver[];
  onChange: (rows: ResultReviewRow[]) => void;
}) {
  const copy = useOperationsCopy();
  const update = (key: string, patch: Partial<ResultReviewRow>) => {
    onChange(rows.map((row) => row.key === key ? { ...row, ...patch } : row));
  };
  const selectDriver = (row: ResultReviewRow, driverId: string) => {
    const driver = drivers.find((candidate) => candidate.id === driverId);
    update(row.key, {
      driverId,
      matchSource: driverId ? 'manual' : 'unassigned',
      teamName: driver?.league_team?.trim() || row.teamName,
      carName: driver?.car_name?.trim() || row.carName,
    });
  };

  return (
    <div className="result-review-editor">
      <div className="result-review-editor-heading">
        <div><h2>{copy('review.title')}</h2><p>{copy('review.copy')}</p></div>
        <strong>{copy('review.rows', { count: rows.length })}</strong>
      </div>
      <p className="result-review-scroll-hint">{copy('review.mobileHint')}</p>
      <div className="result-review-mobile-list">
        {rows.map((row, index) => {
          const { confidence, confidenceLevel } = confidencePresentation(row);
          const selectedDriver = drivers.find((driver) => driver.id === row.driverId);
          return <details className={row.driverId && row.points.trim() ? 'result-review-mobile-row' : 'result-review-mobile-row result-review-mobile-row--attention'} key={row.key}>
            <summary>
              <span className="result-review-mobile-position">{row.finishPosition ? `P${row.finishPosition}` : 'P—'}</span>
              <span className="result-review-mobile-driver"><strong>{selectedDriver?.display_name ?? row.rawDriver}</strong><small>{row.driverId ? copy('review.detected', { driver: row.rawDriver }) : copy('review.assignmentMissing')}</small></span>
              <span className={`result-match-badge result-match-badge--${confidenceLevel}`}>{confidence}%</span>
              <span className={row.points.trim() ? 'result-review-mobile-points' : 'result-review-mobile-points result-review-mobile-points--missing'}>{row.points.trim() ? copy('review.pointsShort', { points: row.points }) : copy('review.pointsMissing')}</span>
            </summary>
            <div className="result-review-mobile-fields">
              <label><span>{copy('review.finishPosition')}</span><input aria-label={copy('review.mobileRowLabel', { field: copy('review.finishPosition'), row: index + 1 })} inputMode="numeric" min="1" onChange={(event) => update(row.key, { finishPosition: event.target.value })} type="number" value={row.finishPosition}/></label>
              <label><span>{copy('review.points')}</span><input aria-label={copy('review.mobileRowLabel', { field: copy('review.points'), row: index + 1 })} inputMode="decimal" min="0" onChange={(event) => update(row.key, { points: event.target.value })} placeholder={copy('review.check')} step="0.5" type="number" value={row.points}/></label>
              <label className="result-review-mobile-field--wide"><span>{copy('review.leagueDriver')}</span><select aria-label={copy('review.mobileRowLabel', { field: copy('review.driver'), row: index + 1 })} onChange={(event) => selectDriver(row, event.target.value)} value={row.driverId}><option value="">{copy('review.assignDriver')}</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name}{driver.gamertag ? ` · ${driver.gamertag}` : ''}{driver.is_active ? '' : ` · ${copy('review.inactive')}`}</option>)}</select><small>{copy('review.confidence', { confidence, source: copy(`review.${row.matchSource}`) })}</small></label>
              <label className="result-review-mobile-field--wide"><span>{copy('review.team')}</span><input aria-label={copy('review.mobileRowLabel', { field: copy('review.team'), row: index + 1 })} onChange={(event) => update(row.key, { teamName: event.target.value })} value={row.teamName}/></label>
              <label><span>{copy('review.startPosition')}</span><input aria-label={copy('review.mobileRowLabel', { field: copy('review.startPosition'), row: index + 1 })} inputMode="numeric" min="1" onChange={(event) => update(row.key, { gridPosition: event.target.value })} type="number" value={row.gridPosition}/></label>
              <label><span>{copy('review.stops')}</span><input aria-label={copy('review.mobileRowLabel', { field: copy('review.stops'), row: index + 1 })} inputMode="numeric" min="0" onChange={(event) => update(row.key, { pitStops: event.target.value })} type="number" value={row.pitStops}/></label>
              <label><span>{copy('review.fastestLapFull')}</span><input aria-label={copy('review.mobileRowLabel', { field: copy('review.fastestLapFull'), row: index + 1 })} onChange={(event) => update(row.key, { fastestLap: event.target.value })} placeholder="1:23,456" value={row.fastestLap}/></label>
              <label><span>{copy('review.timeStatus')}</span><input aria-label={copy('review.mobileRowLabel', { field: copy('review.raceTimeStatus'), row: index + 1 })} onChange={(event) => update(row.key, { raceTime: event.target.value })} placeholder="+0:05,123 / DNF" value={row.raceTime}/></label>
            </div>
          </details>;
        })}
      </div>
      <div className="result-review-table-wrap result-review-desktop-table" role="region" aria-label={copy('review.tableLabel')} tabIndex={0}>
        <table className="result-review-table">
          <thead><tr><th>{copy('review.position')}</th><th>{copy('review.driver')}</th><th>{copy('review.match')}</th><th>{copy('review.team')}</th><th>{copy('review.grid')}</th><th>{copy('review.stops')}</th><th>{copy('review.fastestLap')}</th><th>{copy('review.timeStatus')}</th><th>{copy('review.points')}</th></tr></thead>
          <tbody>{rows.map((row, index) => {
            const { confidence, confidenceLevel } = confidencePresentation(row);
            return <tr className={row.driverId ? '' : 'result-review-row--unmatched'} key={row.key}>
              <td><input aria-label={copy('review.rowLabel', { field: copy('review.finishPosition'), row: index + 1 })} inputMode="numeric" min="1" onChange={(event) => update(row.key, { finishPosition: event.target.value })} type="number" value={row.finishPosition}/></td>
              <td><select aria-label={copy('review.rowLabel', { field: copy('review.driver'), row: index + 1 })} onChange={(event) => selectDriver(row, event.target.value)} value={row.driverId}><option value="">{copy('review.assignDriver')}</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name}{driver.gamertag ? ` · ${driver.gamertag}` : ''}{driver.is_active ? '' : ` · ${copy('review.inactive')}`}</option>)}</select><small>{copy('review.detected', { driver: row.rawDriver })}</small></td>
              <td><span className={`result-match-badge result-match-badge--${confidenceLevel}`}>{confidence}%</span><small>{copy(`review.${row.matchSource}`)}</small></td>
              <td><input aria-label={copy('review.rowLabel', { field: copy('review.team'), row: index + 1 })} onChange={(event) => update(row.key, { teamName: event.target.value })} value={row.teamName}/></td>
              <td><input aria-label={copy('review.rowLabel', { field: copy('review.startPosition'), row: index + 1 })} inputMode="numeric" min="1" onChange={(event) => update(row.key, { gridPosition: event.target.value })} type="number" value={row.gridPosition}/></td>
              <td><input aria-label={copy('review.rowLabel', { field: copy('review.stops'), row: index + 1 })} inputMode="numeric" min="0" onChange={(event) => update(row.key, { pitStops: event.target.value })} type="number" value={row.pitStops}/></td>
              <td><input aria-label={copy('review.rowLabel', { field: copy('review.fastestLapFull'), row: index + 1 })} onChange={(event) => update(row.key, { fastestLap: event.target.value })} placeholder="1:23,456" value={row.fastestLap}/></td>
              <td><input aria-label={copy('review.rowLabel', { field: copy('review.raceTimeStatus'), row: index + 1 })} onChange={(event) => update(row.key, { raceTime: event.target.value })} placeholder="+0:05,123 / DNF" value={row.raceTime}/></td>
              <td><input aria-label={copy('review.rowLabel', { field: copy('review.points'), row: index + 1 })} inputMode="decimal" min="0" onChange={(event) => update(row.key, { points: event.target.value })} placeholder={copy('review.check')} step="0.5" type="number" value={row.points}/></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
