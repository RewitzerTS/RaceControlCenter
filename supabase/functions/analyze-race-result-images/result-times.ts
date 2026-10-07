// One wire format for AI output; display formatting remains a client concern.
export const lapTimePattern = '^\\d{2,}:[0-5]\\d\\.\\d{3}$';
export const raceTimePattern = '^(?:\\d{2,}:[0-5]\\d\\.\\d{3}|\\d{2,}:[0-5]\\d:[0-5]\\d\\.\\d{3}|\\+\\d+\\.\\d{3}|DNF|DNS|DSQ|DNQ|RET|\\+[1-9]\\d* laps?)$';

export const timeInstructions = [
  'Verbindliches Zeitformat für JEDE Zeile: fastest_lap = MM:SS.mmm; race_time als Gesamtzeit = MM:SS.mmm oder bei mindestens einer Stunde HH:MM:SS.mmm. Dezimalpunkt und genau drei Millisekundenstellen, keine Dezimalkommas.',
  'Zeitabstände sind keine Gesamtzeiten: race_time = +SS.mmm (Gesamtsekunden). Beispiel +00:14,337 -> +14.337; eindeutig als Sekunden/Millisekunden gelesene +14:337 -> +14.337. Das Plus niemals entfernen, Abstände niemals als Gesamtzeit ausgeben.',
  'Beispiele: 44:57,962 -> 44:57.962; 1:02:03,456 -> 01:02:03.456; 1:23,456 als schnellste Runde -> 01:23.456. 1:23 bedeutet 1 Minute 23 Sekunden, NICHT 1.023 Sekunden.',
  'Rennstatus DNF, DNS, DSQ, DNQ oder RET bleibt Text. Rundenrückstände als +1 lap bzw. +2 laps ausgeben. Status und Rundenrückstände niemals in Sekunden umrechnen.',
  'Nicht sichtbare oder mehrdeutige Zeitwerte als null ausgeben und bei Unsicherheit eine konkrete Warnung mit Fahrer/Zeile in warnings ergänzen. Keine fehlenden Ziffern oder Zeiten raten. Vor der Ausgabe alle Zeitfelder auf dieses Format prüfen.',
].join('\n');

export function normalizeResultTime(value: unknown, kind: 'lap' | 'race'): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > 32) return null;
  if (kind === 'race') {
    if (/^(DNF|DNS|DSQ|DNQ|RET)$/i.test(raw)) return raw.toUpperCase();
    const lapped = raw.match(/^\+\s*([1-9]\d*)\s*(?:laps?|runden?)$/i);
    if (lapped) return `+${Number(lapped[1])} ${Number(lapped[1]) === 1 ? 'lap' : 'laps'}`;
  }
  const gap = raw.startsWith('+');
  if (gap && kind === 'lap') return null;
  let time = (gap ? raw.slice(1).trim() : raw).replace(',', '.');
  // Exactly three digits after a single colon is the known OCR seconds:ms form.
  if (/^\d+:\d{3}$/.test(time)) time = time.replace(':', '.');
  const match = time.match(/^(?:(\d+):)?(?:(\d{1,2}):)?(\d+)(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const parts = time.split(':');
  const seconds = Number(parts.at(-1));
  if (parts.length > 1 && seconds >= 60) return null;
  if (parts.length === 3 && Number(parts[1]) >= 60) return null;
  const ms = Math.round((parts.length === 3 ? Number(parts[0]) * 3600 + Number(parts[1]) * 60 + seconds
    : parts.length === 2 ? Number(parts[0]) * 60 + seconds : seconds) * 1000);
  if (!Number.isSafeInteger(ms) || ms < 0 || (ms === 0 && !gap)) return null;
  if (gap) return `+${Math.floor(ms / 1000)}.${String(ms % 1000).padStart(3, '0')}`;
  const suffix = `${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
  if (kind === 'race' && ms >= 3600000) return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${suffix}`;
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${suffix}`;
}

export function normalizeAnalysisTimes<T extends { rows: Array<{ fastest_lap: string | null; race_time: string | null }>; warnings: string[] }>(analysis: T): T {
  const warnings = [...analysis.warnings];
  const rows = analysis.rows.map((row, index) => {
    const fastest_lap = normalizeResultTime(row.fastest_lap, 'lap');
    const race_time = normalizeResultTime(row.race_time, 'race');
    if (row.fastest_lap?.trim() && fastest_lap === null) warnings.push(`Zeile ${index + 1}: Schnellste Runde nicht eindeutig lesbar. Bitte im Bild prüfen und ergänzen.`);
    if (row.race_time?.trim() && race_time === null) warnings.push(`Zeile ${index + 1}: Rennzeit nicht eindeutig lesbar. Bitte im Bild prüfen und ergänzen.`);
    return { ...row, fastest_lap, race_time };
  });
  return { ...analysis, rows, warnings };
}
