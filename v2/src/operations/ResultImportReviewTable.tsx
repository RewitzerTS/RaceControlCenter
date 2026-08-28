import type { AiResultAnalysis, AiResultRow } from './imageResultImport';
import type { ImportedResultRow, LeagueDriver } from './operations';
import { parseFastestLapToMs } from './resultCsv';

export type ResultReviewRow = {
  key: string;
  driverId: string;
  rawDriver: string;
  matchSource: string;
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

function findDriverMatch(rawName: string, drivers: LeagueDriver[]): { driver: LeagueDriver; source: string } | null {
  const raw = normalize(rawName);
  if (!raw) return null;
  for (const driver of drivers) {
    if (normalize(driver.gamertag) === raw) return { driver, source: 'Gamertag' };
    if (normalize(driver.display_name) === raw) return { driver, source: 'Fahrername' };
  }
  const candidates = drivers.filter((driver) => {
    const values = [normalize(driver.gamertag), normalize(driver.display_name)].filter((value) => value.length >= 4);
    return values.some((value) => value.includes(raw) || raw.includes(value));
  });
  return candidates.length === 1 ? { driver: candidates[0], source: 'Ähnlicher Name' } : null;
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
        matchSource: match?.source ?? 'Nicht zugeordnet',
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

function requireInteger(value: string, label: string, minimum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) throw new Error(`${label} muss eine ganze Zahl ab ${minimum} sein.`);
  return parsed;
}

export function resultReviewRowsToImported(rows: ResultReviewRow[], drivers: LeagueDriver[]): ImportedResultRow[] {
  if (!rows.length) throw new Error('Die Prüftabelle enthält keine Ergebniszeilen.');
  const driverIds = rows.map((row) => row.driverId);
  if (driverIds.some((id) => !id)) throw new Error('Bitte alle erkannten Fahrer einem Ligafahrer zuordnen.');
  if (new Set(driverIds).size !== driverIds.length) throw new Error('Ein Fahrer darf pro Rennen nur einmal vorkommen.');
  const finishPositions = rows.map((row) => requireInteger(row.finishPosition, 'Die Zielposition', 1));
  if (new Set(finishPositions).size !== finishPositions.length) throw new Error('Eine Zielposition darf nur einmal vergeben werden.');

  return rows.map((row, index) => {
    const driver = drivers.find((candidate) => candidate.id === row.driverId);
    if (!driver) throw new Error(`Der Fahrer in Zeile ${index + 1} ist nicht mehr verfügbar.`);
    const points = Number(row.points.replace(',', '.'));
    if (!row.points.trim() || !Number.isFinite(points) || points < 0) throw new Error(`Bitte die Punkte in Zeile ${index + 1} prüfen.`);
    const fastestLapMs = row.fastestLap ? parseFastestLapToMs(row.fastestLap) : undefined;
    if (row.fastestLap && fastestLapMs === undefined) throw new Error(`Die schnellste Runde in Zeile ${index + 1} ist ungültig.`);
    return {
      driver_id: driver.id,
      driver_name: driver.display_name,
      finish_position: finishPositions[index],
      grid_position: row.gridPosition ? requireInteger(row.gridPosition, 'Die Startposition', 1) : undefined,
      pit_stops: requireInteger(row.pitStops || '0', 'Die Anzahl der Stopps', 0),
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

export function ResultImportReviewTable({ rows, drivers, onChange }: {
  rows: ResultReviewRow[];
  drivers: LeagueDriver[];
  onChange: (rows: ResultReviewRow[]) => void;
}) {
  const update = (key: string, patch: Partial<ResultReviewRow>) => {
    onChange(rows.map((row) => row.key === key ? { ...row, ...patch } : row));
  };
  const selectDriver = (row: ResultReviewRow, driverId: string) => {
    const driver = drivers.find((candidate) => candidate.id === driverId);
    update(row.key, {
      driverId,
      matchSource: driverId ? 'Manuell gewählt' : 'Nicht zugeordnet',
      teamName: driver?.league_team?.trim() || row.teamName,
      carName: driver?.car_name?.trim() || row.carName,
    });
  };

  return (
    <div className="result-review-editor">
      <div className="result-review-editor-heading">
        <div><h2>Erkannte Renndaten prüfen</h2><p>Alle Felder lassen sich direkt bearbeiten. Fahrer und Punkte müssen vor dem Speichern bestätigt sein.</p></div>
        <strong>{rows.length} Zeilen</strong>
      </div>
      <p className="result-review-scroll-hint">Auf kleinen Bildschirmen horizontal wischen, um alle Spalten zu sehen.</p>
      <div className="result-review-table-wrap" role="region" aria-label="Bearbeitbare erkannte Rennergebnisse" tabIndex={0}>
        <table className="result-review-table">
          <thead><tr><th>Pos.</th><th>Fahrer</th><th>Match</th><th>Team</th><th>Grid</th><th>Stopps</th><th>Beste Runde</th><th>Zeit / Status</th><th>Punkte</th></tr></thead>
          <tbody>{rows.map((row, index) => {
            const confidence = Math.round(row.confidence * 100);
            const confidenceLevel = confidence >= 85 ? 'high' : confidence >= 65 ? 'medium' : 'low';
            return <tr className={row.driverId ? '' : 'result-review-row--unmatched'} key={row.key}>
              <td><input aria-label={`Zielposition Zeile ${index + 1}`} inputMode="numeric" min="1" onChange={(event) => update(row.key, { finishPosition: event.target.value })} type="number" value={row.finishPosition}/></td>
              <td><select aria-label={`Fahrer Zeile ${index + 1}`} onChange={(event) => selectDriver(row, event.target.value)} value={row.driverId}><option value="">Fahrer zuordnen</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name}{driver.gamertag ? ` · ${driver.gamertag}` : ''}{driver.is_active ? '' : ' · inaktiv'}</option>)}</select><small>Erkannt: {row.rawDriver}</small></td>
              <td><span className={`result-match-badge result-match-badge--${confidenceLevel}`}>{confidence}%</span><small>{row.matchSource}</small></td>
              <td><input aria-label={`Team Zeile ${index + 1}`} onChange={(event) => update(row.key, { teamName: event.target.value })} value={row.teamName}/></td>
              <td><input aria-label={`Startposition Zeile ${index + 1}`} inputMode="numeric" min="1" onChange={(event) => update(row.key, { gridPosition: event.target.value })} type="number" value={row.gridPosition}/></td>
              <td><input aria-label={`Stopps Zeile ${index + 1}`} inputMode="numeric" min="0" onChange={(event) => update(row.key, { pitStops: event.target.value })} type="number" value={row.pitStops}/></td>
              <td><input aria-label={`Schnellste Runde Zeile ${index + 1}`} onChange={(event) => update(row.key, { fastestLap: event.target.value })} placeholder="1:23,456" value={row.fastestLap}/></td>
              <td><input aria-label={`Rennzeit oder Status Zeile ${index + 1}`} onChange={(event) => update(row.key, { raceTime: event.target.value })} placeholder="+0:05,123 / DNF" value={row.raceTime}/></td>
              <td><input aria-label={`Punkte Zeile ${index + 1}`} inputMode="decimal" min="0" onChange={(event) => update(row.key, { points: event.target.value })} placeholder="Prüfen" step="0.5" type="number" value={row.points}/></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
