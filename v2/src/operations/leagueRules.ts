export const LEAGUE_RULE_KEYS = [
  'ai_strength',
  'race_distance',
  'vehicle_performance',
  'fastest_lap_point',
  'damage',
  'safety_car',
  'red_flag',
  'ghosting',
  'assists',
  'qualifying',
] as const;

export type LeagueRuleKey = typeof LEAGUE_RULE_KEYS[number];

export const LEAGUE_RULE_DEFAULTS: Record<LeagueRuleKey, string> = {
  ai_strength: '90',
  race_distance: '50%',
  vehicle_performance: 'Realistische Leistung',
  fastest_lap_point: 'ja',
  damage: 'Standard',
  safety_car: 'Standard',
  red_flag: 'Standard',
  ghosting: 'ein',
  assists: 'Alle erlaubt',
  qualifying: 'Kurz',
};

const optionAliases: Partial<Record<LeagueRuleKey, Record<string, string>>> = {
  race_distance: {
    'sehr kurz': 'Sehr kurz',
    'kurz': '25%',
    '25%': '25%',
    'mittel': '35%',
    '35%': '35%',
    'lang': '50%',
    '50%': '50%',
    'volle distanz': '100%',
    '100%': '100%',
  },
  vehicle_performance: {
    'reale leistung': 'Realistische Leistung',
    'realistische leistung': 'Realistische Leistung',
    'realistisch': 'Realistische Leistung',
    'gleiche leistung': 'Gleiche Leistung',
    'gleich': 'Gleiche Leistung',
  },
  fastest_lap_point: {
    'ja': 'ja',
    'ein': 'ja',
    'an': 'ja',
    'true': 'ja',
    '1': 'ja',
    'nein': 'nein',
    'aus': 'nein',
    'false': 'nein',
    '0': 'nein',
  },
  damage: {
    'aus': 'Aus',
    'reduziert': 'Reduziert',
    'standard': 'Standard',
    'simulation': 'Simulation',
  },
  safety_car: {
    'aus': 'Aus',
    'reduziert': 'Reduziert',
    'standard': 'Standard',
    'erhöht': 'Erhöht',
  },
  red_flag: {
    'aus': 'Aus',
    'reduziert': 'Reduziert',
    'standard': 'Standard',
    'erhöht': 'Erhöht',
  },
  ghosting: {
    'ein': 'ein',
    'an': 'ein',
    'true': 'ein',
    '1': 'ein',
    'aus': 'aus',
    'false': 'aus',
    '0': 'aus',
  },
  qualifying: {
    'aus': 'Aus',
    'kein': 'Aus',
    'keins': 'Aus',
    'blitz': 'Blitz',
    'kurz': 'Kurz',
    'komplett': 'Komplett',
    'voll': 'Komplett',
  },
};

export function normalizeLeagueRules(input: Record<string, unknown>): Record<string, string> {
  const rules = Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      if (typeof value === 'string') return [[key, value]];
      if (typeof value === 'number' || typeof value === 'boolean') return [[key, String(value)]];
      return [];
    }),
  );

  for (const key of LEAGUE_RULE_KEYS) {
    const raw = rules[key]?.trim();
    if (key === 'ai_strength') {
      const parsed = Number(raw);
      rules[key] = Number.isFinite(parsed)
        ? String(Math.max(0, Math.min(110, Math.round(parsed))))
        : LEAGUE_RULE_DEFAULTS[key];
      continue;
    }

    if (key === 'assists') {
      rules[key] = raw || LEAGUE_RULE_DEFAULTS[key];
      continue;
    }

    rules[key] = optionAliases[key]?.[raw?.toLocaleLowerCase('de-DE') ?? ''] ?? LEAGUE_RULE_DEFAULTS[key];
  }

  return rules;
}
