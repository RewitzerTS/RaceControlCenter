import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lapTimePattern, raceTimePattern, timeInstructions, normalizeResultTime, normalizeAnalysisTimes } from '../../../supabase/functions/analyze-race-result-images/result-times';

describe('AI result time wire contract', () => {
  it.each([
    ['44:57,962', '44:57.962'], ['1:02:03.456', '01:02:03.456'],
    ['62:03,456', '01:02:03.456'], ['+00:00,723', '+0.723'],
    ['+14:337', '+14.337'], ['+12:183', '+12.183'], ['+00:05,123', '+5.123'],
    ['+1:23', '+83.000'], ['1:23', '01:23.000'], ['44:57.9', '44:57.900'],
    ['+0.000', '+0.000'], ['dnf', 'DNF'], ['DNS', 'DNS'], ['DSQ', 'DSQ'],
    ['DNQ', 'DNQ'], ['RET', 'RET'], ['+ 1 Runde', '+1 lap'], ['+ 2 Runden', '+2 laps'],
  ])('normalizes %s without changing its meaning', (input, expected) => {
    const actual = normalizeResultTime(input, 'race');
    expect(actual).toBe(expected);
    expect(actual).toMatch(new RegExp(raceTimePattern));
    expect(normalizeResultTime(actual, 'race')).toBe(actual);
  });
  it.each(['1:23,456', '01:23.456', '83.456'])('normalizes lap %s', input => {
    expect(normalizeResultTime(input, 'lap')).toBe('01:23.456');
    expect(normalizeResultTime(input, 'lap')).toMatch(new RegExp(lapTimePattern));
  });
  it.each(['1:99.123', '1:60:00.000', '-5.123', '1:2:3:4', '14:337?', '1:2x.123', '44:57.9627', '12.3.4', '1 23.456', 'Infinity', '99999999999999999', '0'])('does not guess %s', input => {
    expect(normalizeResultTime(input, 'race')).toBeNull();
  });
  it('does not turn a lap deficit or gap into a fastest lap', () => {
    for (const value of ['+1 lap', '+5.123', 'DNF', null, '']) expect(normalizeResultTime(value, 'lap')).toBeNull();
  });
  it('preserves result identities and warnings, flags unclear fields, never invents times', () => {
    const input = { race_name: 'Japan', warnings: ['Existing warning'], rows: [
      { driver: 'Nils', position: 1, fastest_lap: '1:30,123', race_time: '44:57,962' },
      { driver: 'Adnan', position: 5, fastest_lap: null, race_time: '+14:337' },
      { driver: 'Unknown', position: 6, fastest_lap: '??', race_time: '14:33?' },
      { driver: 'Retired', position: 20, fastest_lap: null, race_time: 'DNF' },
    ] };
    const actual = normalizeAnalysisTimes(input);
    expect(actual.rows[0]).toEqual({ ...input.rows[0], fastest_lap: '01:30.123', race_time: '44:57.962' });
    expect(actual.rows[1].race_time).toBe('+14.337');
    expect(actual.rows[2]).toEqual({ ...input.rows[2], fastest_lap: null, race_time: null });
    expect(actual.rows[3]).toEqual(input.rows[3]);
    expect(actual.warnings).toHaveLength(3);
    expect(actual.warnings[0]).toBe('Existing warning');
    expect(actual.warnings[1]).toContain('Zeile 3');
    expect(input.rows[0].race_time).toBe('44:57,962');
  });
  it('enforces the formats in both the prompt and strict response schema', () => {
    const source = readFileSync(resolve(process.cwd(), '../supabase/functions/analyze-race-result-images/index.ts'), 'utf8');
    expect(source).toContain('pattern: lapTimePattern');
    expect(source).toContain('pattern: raceTimePattern');
    expect(source).toContain('strict: true');
    expect(source).toContain('normalizeAnalysisTimes(JSON.parse(outputText))');
    expect(source).not.toContain('Dezimalpunkt in Komma umwandeln');
    expect(timeInstructions).toContain('+14:337 -> +14.337');
    expect(new RegExp(raceTimePattern).test('+14:337')).toBe(false);
    expect(new RegExp(raceTimePattern).test('44:57,962')).toBe(false);
  });
});
