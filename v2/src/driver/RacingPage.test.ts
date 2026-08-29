import { describe, expect, it } from 'vitest';
import type { useI18n } from '../i18n/I18nProvider';
import {
  classificationLabel,
  MOBILE_RACING_MORE_PATHS,
  MOBILE_RACING_PRIMARY_PATHS,
  raceStatusLabel,
} from './RacingPage';

const translations: Record<string, string> = {
  'racing.classification.classified': 'Klassifiziert',
  'racing.classification.dnf': 'Ausgeschieden',
  'racing.classification.dns': 'Nicht gestartet',
  'racing.classification.dsq': 'Disqualifiziert',
  'racing.classification.notClassified': 'Nicht klassifiziert',
  'racing.status.completed': 'Abgeschlossen',
  'racing.status.scheduled': 'Geplant',
  'racing.status.upcoming': 'Bevorstehend',
  'racing.status.cancelled': 'Abgesagt',
};
const t = ((key: string) => translations[key] ?? key) as ReturnType<typeof useI18n>['t'];

describe('localized racing status labels', () => {
  it('translates stored race lifecycle values', () => {
    expect(raceStatusLabel('completed', t)).toBe('Abgeschlossen');
    expect(raceStatusLabel('scheduled', t)).toBe('Geplant');
    expect(raceStatusLabel('canceled', t)).toBe('Abgesagt');
  });

  it('translates result classification values', () => {
    expect(classificationLabel('classified', t)).toBe('Klassifiziert');
    expect(classificationLabel('dnf', t)).toBe('Ausgeschieden');
    expect(classificationLabel('not_classified', t)).toBe('Nicht klassifiziert');
  });
});

describe('mobile racing navigation', () => {
  it('keeps the four core racing destinations directly visible', () => {
    expect(MOBILE_RACING_PRIMARY_PATHS).toEqual(['/racing', '/racing/calendar', '/racing/results', '/racing/standings']);
  });

  it('moves supporting destinations into More', () => {
    expect(MOBILE_RACING_MORE_PATHS).toEqual(['/racing/grid', '/racing/tracks', '/racing/rules', '/racing/history']);
  });
});
