import { useEffect, useState } from 'react';
import type { LeagueSupabaseClient } from '../lib/supabase';
import type { ResultDraft } from './operations';
import { buildDraftChampionship, draftChampionshipCopy, draftChampionshipError, loadDraftChampionship, type DraftChampionshipSnapshot } from './draftChampionship';
import './draftChampionship.css';

export function DraftChampionshipPreview({ client, drafts, language }: { client: LeagueSupabaseClient; drafts: ResultDraft[]; language: string }) {
  const copy = draftChampionshipCopy(language);
  const [chosen, setChosen] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<DraftChampionshipSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const newest = [...drafts].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.version_number - a.version_number)[0];
  const selected = drafts.some((draft) => draft.id === chosen) ? chosen : newest?.id ?? '';

  useEffect(() => { setChosen(newest?.id ?? ''); }, [newest?.id]);

  useEffect(() => {
    const controller = new AbortController();
    setSnapshot(null); setError(''); setLoading(Boolean(selected));
    if (selected) void loadDraftChampionship(client, selected, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setSnapshot(value); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(draftChampionshipError(reason, language)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [client, selected, refresh, drafts, language]);

  // Hide old rows immediately on selection, even before the loading effect runs.
  const current = snapshot?.versionId === selected ? snapshot : null;
  const rows = current ? buildDraftChampionship(current) : [];
  const format = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  return <section className="admin-data-panel draft-championship" aria-labelledby="draft-championship-heading" aria-busy={loading}>
    <div className="draft-championship-heading"><h2 id="draft-championship-heading">{copy.title}</h2>
      {selected && <button className="text-action" type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>{copy.refresh}</button>}
    </div>
    {!selected ? <p>{copy.empty}</p> : <>
      <p className="draft-championship-note">{copy.note}</p>
      {drafts.length > 1 && <label className="draft-championship-select"><span>{copy.draft}</span><select value={selected} onChange={(event) => setChosen(event.target.value)}>
        {drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.race_name} · V{draft.version_number}</option>)}
      </select></label>}
      {loading && <p role="status">{copy.loading}</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {current && !loading && !error && <>
        <div className="draft-championship-context"><strong>{current.data.season?.name} · {current.raceName} · V{current.versionNumber}</strong>
          <small>{copy.updated}: {new Date(current.generatedAt).toLocaleString(language)}</small></div>
        {current.replacesPublished && <p className="draft-championship-note">{copy.replacement}</p>}
        {current.pendingCorrections > 0 && <p className="draft-championship-note">{copy.steward} {current.pendingCorrections}</p>}
        {rows.length ? <table className="draft-championship-table">
          <caption className="visually-hidden">{copy.title} · {current.raceName}</caption>
          <thead><tr><th scope="col">{copy.position}</th><th scope="col">{copy.driver}</th><th scope="col">{copy.points}</th><th scope="col">{copy.difference}</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.driverId}>
            <td>{row.position}</td><th scope="row"><span>{row.driverName}</span>{row.gamertag && row.gamertag !== row.driverName && <small>{row.gamertag}</small>}</th>
            <td><strong>{format.format(row.points)}</strong></td><td>{row.difference > 0 ? '+' : ''}{format.format(row.difference)}</td>
          </tr>)}</tbody>
        </table> : <p>{copy.noRows}</p>}
      </>}
    </>}
  </section>;
}
