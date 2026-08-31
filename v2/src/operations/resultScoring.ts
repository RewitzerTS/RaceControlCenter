import { parseFastestLapToMs } from './resultCsv';

export const DEFAULT_RESULT_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

export type ResultScoringRules = {
  points: number[];
  fastestLapBonusEnabled: boolean;
  fastestLapBonusPoints: number;
  fastestLapBonusMaxFinishPosition: number;
};

export const DEFAULT_RESULT_SCORING_RULES: ResultScoringRules = {
  points: [...DEFAULT_RESULT_POINTS],
  fastestLapBonusEnabled: false,
  fastestLapBonusPoints: 1,
  fastestLapBonusMaxFinishPosition: 10,
};

type ScorableResultRow = {
  key: string;
  finishPosition: string;
  fastestLap: string;
  points: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function scoringPointsFromLeagueSettings(settings: unknown): number[] {
  const scoring = record(record(settings)?.scoring);
  const configured = Array.isArray(scoring?.points)
    ? scoring.points.map(Number).filter((value) => Number.isFinite(value) && value >= 0)
    : [];
  return configured.length ? configured : [...DEFAULT_RESULT_POINTS];
}

export function fastestLapWinnerKey(rows: readonly ScorableResultRow[]): string | null {
  let winner: { key: string; milliseconds: number; finishPosition: number } | null = null;

  for (const row of rows) {
    const milliseconds = parseFastestLapToMs(row.fastestLap);
    if (milliseconds === undefined) continue;
    const finishPosition = Number(row.finishPosition);
    const comparablePosition = Number.isInteger(finishPosition) && finishPosition > 0
      ? finishPosition
      : Number.POSITIVE_INFINITY;
    if (
      !winner
      || milliseconds < winner.milliseconds
      || (milliseconds === winner.milliseconds && comparablePosition < winner.finishPosition)
    ) {
      winner = { key: row.key, milliseconds, finishPosition: comparablePosition };
    }
  }

  return winner?.key ?? null;
}

function pointsField(value: number): string {
  return String(Number(Math.max(0, value).toFixed(2)));
}

export function scoreResultReviewRows<T extends ScorableResultRow>(
  rows: readonly T[],
  rules: ResultScoringRules = DEFAULT_RESULT_SCORING_RULES,
): T[] {
  const fastestKey = fastestLapWinnerKey(rows);
  return rows.map((row) => {
    const finishPosition = Number(row.finishPosition);
    const validPosition = Number.isInteger(finishPosition) && finishPosition >= 1;
    const basePoints = validPosition ? Number(rules.points[finishPosition - 1] ?? 0) : 0;
    const fastestLapBonus = rules.fastestLapBonusEnabled
      && row.key === fastestKey
      && validPosition
      && finishPosition <= rules.fastestLapBonusMaxFinishPosition
      ? rules.fastestLapBonusPoints
      : 0;
    return { ...row, points: pointsField(basePoints + fastestLapBonus) };
  });
}
