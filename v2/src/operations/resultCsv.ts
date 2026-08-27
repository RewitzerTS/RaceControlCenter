import type { ImportedResultRow } from './operations';

function detectDelimiter(header: string) {
  return (header.match(/;/g) ?? []).length > (header.match(/,/g) ?? []).length ? ';' : ',';
}

function parseLine(line: string, delimiter: string) {
  const values: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

export function parseFastestLapToMs(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return undefined;
  const match = normalized.match(/^(?:(\d+):)?([0-5]?\d)(?:\.(\d{1,3}))$/);
  if (!match) return undefined;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  const milliseconds = Number(match[3].padEnd(3, '0'));
  const total = (minutes * 60 + seconds) * 1000 + milliseconds;
  return total > 0 && total <= 600_000 ? total : undefined;
}

export function parseResultCsv(text: string): ImportedResultRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV benötigt Kopfzeile und mindestens eine Ergebniszeile.');

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter).map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase());
  const indexOf = (keys: string[]) => keys.map((key) => headers.indexOf(key)).find((index) => index >= 0) ?? -1;
  const driverIndex = indexOf(['driver', 'driver_name']);
  if (driverIndex < 0) throw new Error('CSV-Spalte driver fehlt.');

  return lines.slice(1).map((line, index) => {
    const parts = parseLine(line, delimiter);
    const at = (keys: string[]) => {
      const column = indexOf(keys);
      return column >= 0 ? parts[column]?.trim() ?? '' : '';
    };
    const driver = parts[driverIndex]?.trim() ?? '';
    const finish = Number(at(['finish_position', 'position']));
    const gridText = at(['grid_position', 'start_position']);
    const grid = gridText ? Number(gridText) : undefined;
    const points = Number((at(['points']) || '0').replace(',', '.'));
    const fastestLapText = at(['fastest_lap_time', 'fastest_lap']);
    const explicitFastestLapMs = at(['fastest_lap_time_ms', 'fastest_lap_ms']);
    const fastestLapMs = explicitFastestLapMs ? Number(explicitFastestLapMs) : parseFastestLapToMs(fastestLapText);

    if (
      !driver
      || !Number.isInteger(finish)
      || finish < 1
      || (grid !== undefined && (!Number.isInteger(grid) || grid < 1))
      || !Number.isFinite(points)
      || (explicitFastestLapMs !== '' && (!Number.isInteger(fastestLapMs) || Number(fastestLapMs) <= 0 || Number(fastestLapMs) > 600_000))
      || (fastestLapText !== '' && fastestLapMs === undefined)
    ) {
      throw new Error(`Ungültige CSV-Zeile ${index + 2}. Fahrer, Position, Startplatz, Punkte und schnellste Runde müssen geprüft werden.`);
    }

    return {
      driver_name: driver,
      finish_position: finish,
      grid_position: grid,
      points,
      team_name: at(['team_name']) || undefined,
      car_name: at(['car_name']) || undefined,
      fastest_lap_time: fastestLapText || undefined,
      fastest_lap_time_ms: fastestLapMs,
    };
  });
}
