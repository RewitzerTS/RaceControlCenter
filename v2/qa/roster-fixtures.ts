export const roster = {
  season_id: 'qa-season',
  races: [
    { id: 'r1', round: 1, name: 'Großer Preis von Bahrain', locked: true },
    { id: 'r2', round: 2, name: 'Großer Preis von Saudi-Arabien', locked: false },
    { id: 'r3', round: 3, name: 'Großer Preis von Australien', locked: false },
  ], substitutions: [], vehicles: [],
};
export const client = { rpc: async () => ({ data: roster, error: null }) };
export function useLeague() { return { client, leagueSlug: 'qa-only' }; }
export function useI18n() { return { language: 'de' }; }
