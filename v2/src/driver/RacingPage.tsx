import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import type { Database } from '../types/database';

type RaceRow = Pick<
  Database['public']['Tables']['races']['Row'],
  'circuit_name' | 'country_code' | 'current_result_version_id' | 'grand_prix_name' | 'id' | 'race_date' | 'race_start_at' | 'round_number' | 'status'
>;

interface ResultRow {
  awarded_points: number;
  classification_status: string;
  driver_id: string;
  driver: { display_name: string } | null;
  fastest_lap_time: string | null;
  finish_position: number | null;
  grid_position: number | null;
  id: string;
  race_time: string | null;
}

function classificationLabel(status: string): string {
  return status.replaceAll('_', ' ').toUpperCase();
}

export function RacingPage() {
  const { client, leagueSlug } = useLeague();
  const { formatDate, formatNumber, formatTime, t } = useI18n();
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadRaces = useCallback(async () => {
    setLoading(true);
    setError(false);
    const response = await client
      .from('races')
      .select('id, round_number, grand_prix_name, circuit_name, country_code, race_date, race_start_at, status, current_result_version_id')
      .order('round_number', { ascending: false })
      .limit(100);

    if (response.error) {
      setRaces([]);
      setSelectedRaceId(null);
      setError(true);
    } else {
      const nextRaces = response.data ?? [];
      setRaces(nextRaces);
      setSelectedRaceId((current) => (
        current && nextRaces.some((race) => race.id === current)
          ? current
          : nextRaces.find((race) => race.current_result_version_id)?.id ?? nextRaces[0]?.id ?? null
      ));
    }
    setLoading(false);
  }, [client]);

  useEffect(() => { void loadRaces(); }, [loadRaces]);

  const selectedRace = useMemo(
    () => races.find((race) => race.id === selectedRaceId) ?? null,
    [races, selectedRaceId],
  );

  useEffect(() => {
    let active = true;
    setResults([]);
    if (!selectedRace?.current_result_version_id) {
      setResultsLoading(false);
      return () => { active = false; };
    }

    setResultsLoading(true);
    void client
      .from('race_results')
      .select('id, driver_id, finish_position, grid_position, classification_status, race_time, fastest_lap_time, awarded_points, driver:drivers!race_results_driver_id_fkey(display_name)')
      .eq('race_id', selectedRace.id)
      .eq('result_version_id', selectedRace.current_result_version_id)
      .order('finish_position', { ascending: true, nullsFirst: false })
      .then((response) => {
        if (!active) return;
        if (response.error) {
          setError(true);
          setResults([]);
        } else {
          setResults((response.data ?? []) as ResultRow[]);
        }
        setResultsLoading(false);
      });

    return () => { active = false; };
  }, [client, selectedRace]);

  if (loading) {
    return <main className="driver-state" id="main-content"><span className="state-mark" aria-hidden="true">24</span><div><h1>{t('home.loadingTitle')}</h1><p>{t('racing.loadingCopy')}</p></div></main>;
  }

  if (error && races.length === 0) {
    return <main className="driver-state" id="main-content"><span className="state-mark" aria-hidden="true">!</span><div><h1>{t('racing.errorTitle')}</h1><p>{t('home.errorCopy')}</p><button className="text-action" type="button" onClick={() => void loadRaces()}>{t('home.retry')}</button></div></main>;
  }

  return (
    <main className="racing-page dashboard-shell" id="main-content">
      <section className="storyline-strip">
        <strong>{t('route.racingTitle')}</strong>
        <span>{t('racing.leagueContext', { league: leagueSlug })}</span>
        <i aria-hidden="true">•</i>
        <span>{t('racing.officialCopy')}</span>
      </section>

      <section className="racing-layout">
        <aside className="dashboard-card race-browser" aria-labelledby="race-browser-title">
          <div className="section-heading">
            <div><p className="section-label">{t('racing.calendar')}</p><h1 id="race-browser-title">{t('admin.races')}</h1></div>
            <strong>{formatNumber(races.length)}</strong>
          </div>
          {races.length === 0 ? <p className="empty-copy">{t('racing.empty')}</p> : (
            <ol className="race-list">
              {races.map((race) => (
                <li key={race.id}>
                  <button
                    aria-current={race.id === selectedRaceId ? 'true' : undefined}
                    className={race.id === selectedRaceId ? 'race-list-item race-list-item--active' : 'race-list-item'}
                    onClick={() => setSelectedRaceId(race.id)}
                    type="button"
                  >
                    <span className="race-round">{t('graphics.round')} {formatNumber(race.round_number)}</span>
                    <strong>{race.grand_prix_name}</strong>
                    <small>{race.race_date ? formatDate(race.race_date) : t('home.dateTbd')}</small>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>

        <section className="dashboard-card race-result-card" aria-labelledby="race-result-title">
          {selectedRace ? (
            <>
              <div className="race-result-heading">
                <div>
                  <p className="section-label">{t('racing.officialResult')}</p>
                  <h2 id="race-result-title">{selectedRace.grand_prix_name}</h2>
                  <p>{selectedRace.circuit_name ?? selectedRace.country_code ?? t('racing.circuitPending')}</p>
                </div>
                <div className="race-date-block">
                  <strong>{selectedRace.race_date ? formatDate(selectedRace.race_date) : t('home.dateTbd')}</strong>
                  <span>{selectedRace.race_start_at ? formatTime(selectedRace.race_start_at) : selectedRace.status}</span>
                </div>
              </div>
              {!selectedRace.current_result_version_id ? (
                <p className="empty-copy">{t('racing.noOfficialResult')}</p>
              ) : resultsLoading ? (
                <p className="empty-copy">{t('racing.resultsLoading')}</p>
              ) : results.length === 0 ? (
                <p className="empty-copy">{t('racing.noOfficialResult')}</p>
              ) : (
                <div className="responsive-table result-table-wrap">
                  <table>
                    <thead><tr><th>{t('racing.position')}</th><th>{t('racing.driver')}</th><th>{t('racing.grid')}</th><th>{t('racing.time')}</th><th>{t('racing.fastestLap')}</th><th>{t('graphics.points')}</th></tr></thead>
                    <tbody>
                      {results.map((result) => (
                        <tr key={result.id}>
                          <td><strong>{result.finish_position == null ? classificationLabel(result.classification_status) : `P${formatNumber(result.finish_position)}`}</strong><small>{classificationLabel(result.classification_status)}</small></td>
                          <td><strong>{result.driver?.display_name ?? result.driver_id.slice(0, 8)}</strong></td>
                          <td>{result.grid_position == null ? '—' : `P${formatNumber(result.grid_position)}`}</td>
                          <td>{result.race_time ?? '—'}</td>
                          <td>{result.fastest_lap_time ?? '—'}</td>
                          <td>{formatNumber(result.awarded_points)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : <p className="empty-copy">{t('racing.empty')}</p>}
        </section>
      </section>
    </main>
  );
}
