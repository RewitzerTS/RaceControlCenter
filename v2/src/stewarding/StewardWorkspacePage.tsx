import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, EmptyState } from '../components/AppState';
import { useFeatureFlags } from '../features/FeatureFlagProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { activeStewardRaces, createStewardCase, deleteStewardCase, loadStewardCaseDetail, loadStewardWorkspace,
  nextStewardRace, recordStewardDecision, type SimplePenaltyType, type SimpleStewardInput,
  type StewardCase, type StewardCaseDetail, type StewardPenalty, type StewardWorkspaceSnapshot } from './stewardWorkspace';
import { simpleStewardMessages } from './simpleStewardMessages';
import './simpleSteward.css';

const EMPTY: StewardWorkspaceSnapshot = { cases: [], races: [], drivers: [] };

export function PenaltyLabel({ penalty }: { penalty: StewardPenalty }) {
  const { language, formatNumber } = useI18n(), c = simpleStewardMessages[language];
  const label = c[penalty.penalty_type as SimplePenaltyType] || penalty.penalty_type;
  return <span>{label}{penalty.time_delta_ms != null ? ` · ${penalty.time_delta_ms > 0 ? '+' : '−'}${formatNumber(Math.abs(penalty.time_delta_ms) / 1000)} s` : penalty.grid_positions ? ` · ${penalty.grid_positions}` : ''}{['time_penalty','time_credit'].includes(penalty.penalty_type) && <><br /><small>{penalty.applied_result_version_id ? c.applied : c.pending}</small></>}</span>;
}

export function StewardWorkspacePage() {
  const { t, language, formatDate } = useI18n(), c = simpleStewardMessages[language];
  const { client } = useLeague(), { role, loading: roleLoading } = useRole();
  const flags = useFeatureFlags();
  const permitted = role === 'steward' || role === 'league_admin' || role === 'platform_owner';
  const [snapshot, setSnapshot] = useState(EMPTY), [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StewardCaseDetail | null>(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null), [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleting = useRef(false);
  const selected = snapshot.cases.find((item) => item.id === selectedId);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const value = await loadStewardWorkspace(client); setSnapshot(value); setSelectedId((id) => value.cases.some((item) => item.id === id) ? id : value.cases[0]?.id ?? null); }
    catch { setError(t('steward.loadError')); }
    finally { setLoading(false); }
  }, [client, t]);
  useEffect(() => { if (flags.stewardWorkspace) void refresh(); }, [flags.stewardWorkspace, refresh]);
  useEffect(() => {
    let active = true; setDetail(null);
    if (selectedId) void loadStewardCaseDetail(client, selectedId).then((value) => { if (active) setDetail(value); })
      .catch(() => { if (active) setError(t('steward.loadError')); });
    return () => { active = false; };
  }, [client, selectedId, snapshot, t]);

  async function submit(input: SimpleStewardInput, key: string, draft: boolean) {
    if (busy) return false;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (draft) await createStewardCase(client, { raceId: input.raceId, reportedDriverId: input.reporterId,
        accusedDriverId: input.accusedId, title: input.title, description: input.reasoning, ruleCode: 'Stewardentscheidung', ruleVersion: '1', idempotencyKey: key });
      else await recordStewardDecision(client, input, key);
      setShowCreate(false); setNotice(draft ? t('steward.caseCreated') : c.published);
      await refresh(); return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(/negative/.test(message) ? c.negativeTime : /race time|race times|classified result/.test(message) ? c.badTime
        : /next scheduled/.test(message) ? c.noNext : /Publish the race result/.test(message) ? c.noResult
        : c.actionError);
      return false;
    } finally { setBusy(false); }
  }
  async function removeCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy || deleting.current) return;
    const reason = String(new FormData(event.currentTarget).get('deleteReason') || '');
    deleting.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      await deleteStewardCase(client, selected.id, reason, selected.current_decision_version,
        snapshot.races.find((r) => r.id === selected.race_id)?.current_result_version_id ?? null);
      setDeleteId(null); setDetail(null); setNotice(c.deleted); await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(/Reload before deleting/.test(message) ? c.deleteStale
        : /Result history changed|Legacy penalty/.test(message) ? c.deleteHistory
        : /race time|race times|classified result|negative/.test(message) ? c.deleteTime : c.deleteError);
    } finally { deleting.current = false; setBusy(false); }
  }
  if (roleLoading) return <AppState title={t('pending')} tone="loading" />;
  if (!flags.stewardWorkspace) return <AppState copy={t('steward.deniedCopy')} title={t('steward.deniedTitle')} tone="denied" />;
  return <main className="steward-workspace simple-steward" id="main-content">
    <header className="steward-heading"><div><h1>{t('steward.title')}</h1><p>{c.intro}</p></div>
      {permitted && <button className="primary-action action-button" disabled={busy} onClick={() => setShowCreate(!showCreate)} type="button">{showCreate ? t('steward.cancel') : t('steward.newCase')}</button>}
    </header>
    {error && <p className="workspace-message workspace-message--error" role="alert">{error}</p>}
    {notice && <p className="workspace-message" role="status">{notice}</p>}
    {permitted && showCreate && <DecisionForm key="new" snapshot={snapshot} busy={busy} onSubmit={submit} />}
    <div className={selected && !showCreate ? 'case-layout' : 'case-layout case-layout--queue-only'}>
      <section className="case-queue" aria-label={t('steward.queue')}>
        <div className="case-section-title"><span>{t('steward.queue')}</span><small>{t('steward.pagination')}</small></div>
        {loading ? <p role="status">{t('pending')}</p> : snapshot.cases.length === 0 ? <EmptyState title={t('steward.empty')} copy={c.intro} /> : snapshot.cases.map((item) => <button key={item.id} type="button" className={item.id === selectedId ? 'case-row case-row--active' : 'case-row'} disabled={busy} onClick={() => { setSelectedId(item.id); setShowCreate(false); }}>
          <span><strong>{item.case_number}</strong><span className={`case-status case-status--${item.status}`}>{t(`steward.status.${item.status}` as Parameters<typeof t>[0])}</span></span>
          <b>{item.title}</b><small>{snapshot.races.find((r) => r.id === item.race_id)?.grand_prix_name} · {formatDate(item.created_at)}</small>
        </button>)}
      </section>
      {selected && !showCreate && <section className="case-detail">
        <h2>{selected.title}</h2>
        <dl className="case-facts">{[[t('steward.race'), snapshot.races.find((r) => r.id === selected.race_id)?.grand_prix_name],
          [c.reporter, snapshot.drivers.find((d) => d.id === selected.reported_driver_id)?.display_name],
          [c.accused, snapshot.drivers.find((d) => d.id === selected.accused_driver_id)?.display_name]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
        <p className="case-description">{selected.description}</p>
        {permitted && <div className="steward-delete">
          {deleteId !== selected.id ? <button className="text-action" type="button" disabled={busy || !detail} onClick={() => setDeleteId(selected.id)}>{c.deleteCase}</button>
            : <form key={selected.id} onSubmit={removeCase} aria-label={c.deleteCase}>
              <h3>{c.deleteConfirm}</h3><p>{c.deleteHint}</p>
              <label>{c.deleteReason}<textarea name="deleteReason" minLength={10} maxLength={2000} required disabled={busy} /></label>
              <div className="simple-steward-submit"><button className="text-action" type="button" disabled={busy} onClick={() => setDeleteId(null)}>{t('steward.cancel')}</button>
                <button className="text-action danger-action" type="submit" disabled={busy}>{busy ? t('pending') : c.deleteNow}</button></div>
            </form>}
        </div>}
        {!detail ? <p role="status">{t('pending')}</p> : <>
          {detail.decisions.map((decision) => <section className="simple-decision" key={decision.id}>
            <h3>{c.decision} · {formatDate(decision.finalized_at)}</h3><p>{decision.reasoning}</p>
            {decision.outcome === 'no_action' && <strong>{c.no_action}</strong>}
            {detail.penalties.filter((p) => p.decision_version_id === decision.id).map((penalty) => <p key={penalty.id}><strong><PenaltyLabel penalty={penalty} /></strong>{penalty.target_race_id && <><br />{c.target}: {snapshot.races.find((r) => r.id === penalty.target_race_id)?.grand_prix_name || '—'}<br />{c.gridHint}</>}</p>)}
          </section>)}
          {(detail.evidence.length > 0 || detail.votes.length > 0 || detail.appeals.length > 0) && <details className="simple-steward-history"><summary>{c.history}</summary>
            {detail.evidence.map((e) => <p key={e.id}>{e.description}{e.uri && /^https?:\/\//i.test(e.uri) && <> · <a href={e.uri} target="_blank" rel="noreferrer">{t('steward.openEvidence')}</a></>}</p>)}
            {detail.votes.map((v) => <p key={v.id}>{v.reasoning}</p>)}{detail.appeals.map((a) => <p key={a.id}>{a.reason}</p>)}
          </details>}
          {permitted && selected.status === 'under_review' && (selected.reported_driver_id
            ? <DecisionForm key={selected.id} existing={selected} snapshot={snapshot} busy={busy} onSubmit={submit} />
            : <p role="status">{c.oldReporter}</p>)}
        </>}
      </section>}
    </div>
  </main>;
}

function DecisionForm({ snapshot, existing, busy, onSubmit }: { snapshot: StewardWorkspaceSnapshot; existing?: StewardCase; busy: boolean;
  onSubmit: (input: SimpleStewardInput, key: string, draft: boolean) => Promise<boolean> }) {
  const { t, language } = useI18n(), c = simpleStewardMessages[language];
  const races = existing ? snapshot.races.filter((r) => r.id === existing.race_id) : activeStewardRaces(snapshot);
  const [raceId,setRaceId] = useState(existing?.race_id || races[0]?.id || '');
  const [kind,setKind] = useState<SimplePenaltyType>('time_penalty');
  const [localError,setLocalError] = useState<string | null>(null);
  const pending = useRef(false), retry = useRef<{ payload: string; key: string } | null>(null);
  const race = snapshot.races.find((r) => r.id === raceId), next = nextStewardRace(snapshot.races,raceId);
  const needsTime = kind === 'time_penalty' || kind === 'time_credit';
  const canPublish = Boolean(race && (kind !== 'grid_penalty' || next));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return;
    const form = event.currentTarget, data = new FormData(form);
    const draft = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'draft';
    const input: SimpleStewardInput = { raceId, reporterId: existing?.reported_driver_id || String(data.get('reporter')),
      accusedId: existing?.accused_driver_id || String(data.get('accused')), title: existing?.title || String(data.get('title')),
      reasoning: String(data.get('reasoning')), penaltyType: kind, amount: kind === 'no_action' ? null : Number(data.get('amount')),
      targetRaceId: kind === 'grid_penalty' ? next?.id || null : null, caseId: existing?.id || null };
    if (!draft && (!canPublish || data.get('confirmed') !== 'on')) { setLocalError(!canPublish ? c.noNext : c.confirmRequired); form.querySelector<HTMLInputElement>('[name="confirmed"]')?.focus(); return; }
    setLocalError(null); const payload = JSON.stringify({ input,draft });
    if (retry.current?.payload !== payload) retry.current = { payload,key:crypto.randomUUID() };
    pending.current = true;
    try { if (await onSubmit(input,retry.current.key,draft)) retry.current = null; } finally { pending.current = false; }
  }
  return <form className="steward-form steward-form--create simple-steward-form" onSubmit={submit}>
    <h2 className="span-two">{existing ? c.open : t('steward.newCase')}</h2>
    {!existing && <><label className="span-two">{t('steward.race')}<select name="race" value={raceId} onChange={(e) => setRaceId(e.target.value)} required>{races.map((r) => <option key={r.id} value={r.id}>{r.round_number}. {r.grand_prix_name}</option>)}</select></label>
      <label>{c.reporter}<select name="reporter" defaultValue="" required><option value="" disabled>{c.choose}</option>{snapshot.drivers.map((d) => <option key={d.id} value={d.id}>{d.display_name}</option>)}</select></label>
      <label>{c.accused}<select name="accused" defaultValue="" required><option value="" disabled>{c.choose}</option>{snapshot.drivers.map((d) => <option key={d.id} value={d.id}>{d.display_name}</option>)}</select></label>
      <p className="span-two">{c.selfReport}</p>
      <label className="span-two">{t('steward.caseTitle')}<input name="title" minLength={4} maxLength={140} required /></label></>}
    <label>{c.decision}<select name="penaltyType" value={kind} onChange={(e) => setKind(e.target.value as SimplePenaltyType)}>{(['time_penalty','time_credit','grid_penalty','no_action'] as const).map((k) => <option key={k} value={k}>{c[k]}</option>)}</select></label>
    {kind !== 'no_action' && <label>{kind === 'grid_penalty' ? c.places : c.seconds}<input key={kind} name="amount" type="number" min={kind === 'grid_penalty' ? 1 : 0.001} max={kind === 'grid_penalty' ? 99 : 3600} step={kind === 'grid_penalty' ? 1 : 0.001} defaultValue={5} required /></label>}
    {kind === 'grid_penalty' && <p className="span-two" role="status">{next ? <><strong>{c.target}: {next.round_number}. {next.grand_prix_name}</strong><br />{c.gridHint}</> : c.noNext}</p>}
    {needsTime && <p className="span-two" role="status">{race?.current_result_version_id ? c.timeHint : c.noResult}</p>}
    <label className="span-two">{c.reasoning}<textarea name="reasoning" minLength={10} maxLength={4000} required /></label>
    <label className="check-label span-two"><input name="confirmed" type="checkbox" />{c.confirm}</label>
    {localError && <p className="span-two" role="alert">{localError}</p>}
    <div className="simple-steward-submit span-two"><button className="primary-action action-button" type="submit" disabled={busy || !canPublish}>{c.publish}</button>
      {!existing && <button className="text-action" type="submit" value="draft" disabled={busy || !raceId}>{c.draft}</button>}</div>
  </form>;
}
