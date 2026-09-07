import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import { racingHref } from './calendarData';
import { buildResultsMatrix, loadResults, loadResultsOwnDriver, resultsFocusIds, type ResultsData } from './resultsData';
import { resultsMessages } from './resultsMessages';
import { ResultsCharts } from './ResultsCharts';
import './racing.css';
import './results.css';

export function RacingResults() {
  const { client, leagueSlug } = useLeague();
  const { user, loading: authLoading } = useAuth();
  const { language, formatNumber } = useI18n();
  const copy = resultsMessages[language];
  const userId = user?.id ?? '';
  const [data, setData] = useState<ResultsData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [own, setOwn] = useState('');
  const [ownError, setOwnError] = useState(false);
  const [ownRetry, setOwnRetry] = useState(0);
  const [mode, setMode] = useState('leaders');
  const [compare, setCompare] = useState<string[]>([]);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 700px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const change = () => setCompact(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false); setLoading(true); setOwn(''); setMode('leaders'); setCompare([]);
    if (!authLoading) void loadResults(client, leagueSlug, Boolean(userId), controller.signal).then((next) => {
      if (!controller.signal.aborted) { setData(next); setLoading(false); }
    }).catch(() => { if (!controller.signal.aborted) { setError(true); setLoading(false); } });
    return () => controller.abort();
  }, [client, leagueSlug, userId, authLoading, retry]);
  const matrix = useMemo(() => data ? buildResultsMatrix(data) : { completedRaces: [], rows: [] }, [data]);
  useEffect(() => { setCompare(matrix.rows.filter((row) => row.driver.id !== own).slice(0, 2).map((row) => row.driver.id)); }, [matrix, own]);
  useEffect(() => {
    const controller = new AbortController();
    setOwn(''); setOwnError(false);
    if (data && userId) void loadResultsOwnDriver(client, userId, data.drivers, controller.signal).then((id) => {
      if (!controller.signal.aborted) setOwn(id);
    }).catch(() => { if (!controller.signal.aborted) setOwnError(true); });
    return () => controller.abort();
  }, [client, data, userId, ownRetry]);
  const visible = useMemo(() => resultsFocusIds(matrix.rows, mode, own, compare, compact), [matrix, mode, own, compare, compact]);
  return <section className="native-racing native-results" data-native-racing="results" aria-labelledby="results-title">
    <header><h1 id="results-title">{copy.title}</h1><p>{copy.subtitle}</p></header>
    {loading ? <p role="status">{copy.loading}</p> : error ? <div role="alert"><p>{copy.error}</p><button type="button" data-results-retry onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button></div> : !data?.season ? <div><h2>{copy.noSeason}</h2><p>{copy.noSeasonCopy}</p></div> : <>
      <section className="results-table-panel" aria-labelledby="results-matrix-title">
        <div className="results-table-heading"><h2 id="results-matrix-title">{copy.matrix}</h2><span id="results-matrix-label">{formatNumber(matrix.completedRaces.length)} {copy.races} · {formatNumber(matrix.rows.length)} {copy.drivers}</span></div>
        <div className="results-legend"><span className="results-marker results-marker--fl">{copy.fastest}</span><span className="results-marker results-marker--bot">{copy.bot}</span></div>
        {!matrix.rows.length ? <p>{copy.empty}</p> : <div className="results-scroll" id="results-matrix-wrap" tabIndex={0} role="region" aria-label={copy.scroll}><table className="results-matrix-table">
          <thead><tr><th scope="col" className="sticky-driver">{copy.drivers}</th>{matrix.completedRaces.map((race) => <th scope="col" className="results-race-header" key={race.id}><Link to={racingHref('/racing/races/detail', leagueSlug, { season: data.season!.id, round: race.round_number })} title={`R${race.round_number} · ${race.grand_prix_name}`}>{race.grand_prix_name}</Link></th>)}<th scope="col">{copy.total}</th></tr></thead>
          <tbody>{matrix.rows.map((row) => <tr key={row.driver.id} data-driver-id={row.driver.id}><th scope="row" className="sticky-driver"><Link to={racingHref('/racing/drivers/profile', leagueSlug, { driver: row.driver.id })}>{row.driver.display_name}{row.driver.gamertag ? ` / ${row.driver.gamertag}` : ''}</Link></th>{row.raceCells.map((cell, index) => <td className="results-points-cell" key={matrix.completedRaces[index].id} title={`${copy.car}: ${cell.carName}`}><div className="results-cell-stack"><span className={`results-points-value${cell.hasFastestLap ? ' results-points-value--fl' : ''}`}>{formatNumber(cell.points)}</span>{cell.hasFastestLap && <span className="results-marker results-marker--fl" data-result-marker="fl" aria-label={copy.fastestLabel}>FL</span>}{cell.isBot && <span className="results-marker results-marker--bot" data-result-marker="bot" aria-label={copy.botLabel}>BOT</span>}</div></td>)}<td className="results-total-cell"><strong>{formatNumber(row.total)}</strong></td></tr>)}</tbody>
        </table></div>}
      </section>
      {matrix.completedRaces.length > 0 && matrix.rows.length > 0 && <>
        <div className="results-focus" role="group" aria-label={copy.focus}>
          {(['leaders', 'own', 'compare'] as const).map((value) => <button type="button" key={value} data-results-focus-mode={value} aria-pressed={mode === value} disabled={value === 'own' && !own} title={value === 'own' && !own ? copy.noOwn : undefined} onClick={() => setMode(value)}>{copy[value]}</button>)}
          {mode === 'compare' && <div className="results-compare">{[0, 1].map((index) => <label key={index}>{index ? copy.second : copy.first}<select value={compare[index] ?? ''} onChange={(event) => setCompare((values) => index ? [values[0] ?? '', event.target.value] : [event.target.value, values[1] ?? ''])}><option value="">{copy.choose}</option>{matrix.rows.map((row) => <option key={row.driver.id} value={row.driver.id} disabled={compare[1 - index] === row.driver.id}>{row.driver.display_name}</option>)}</select></label>)}</div>}
          <p role="status" className="results-focus-status">{visible.map((id) => matrix.rows.find((row) => row.driver.id === id)?.driver.display_name).join(' · ')}</p>
        </div>
        {ownError && <p role="status">{copy.ownError} <button type="button" onClick={() => setOwnRetry((value) => value + 1)}>{copy.ownRetry}</button></p>}
        <ResultsCharts matrix={matrix} visible={visible} copy={copy} />
      </>}
    </>}
  </section>;
}
