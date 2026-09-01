import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, EmptyState } from '../components/AppState';
import { useFeatureFlags } from '../features/FeatureFlagProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import {
  addStewardEvidence,
  activeStewardRaces,
  castStewardVote,
  createStewardCase,
  finalizeStewardDecision,
  loadStewardCaseDetail,
  loadStewardWorkspace,
  stewardDetailCounts,
  type StewardCaseDetail,
  type StewardWorkspaceSnapshot,
} from './stewardWorkspace';

const EMPTY_SNAPSHOT: StewardWorkspaceSnapshot = { cases: [], races: [], drivers: [] };

function StatusPill({ value }: { value: string }) {
  const { t } = useI18n();
  const key = `steward.status.${value}` as Parameters<typeof t>[0];
  return <span className={`case-status case-status--${value}`}>{t(key)}</span>;
}

export function StewardWorkspacePage() {
  const { t, formatDate } = useI18n();
  const { client } = useLeague();
  const { role, loading: roleLoading } = useRole();
  const flags = useFeatureFlags();
  const permitted = role === 'steward' || role === 'league_admin' || role === 'platform_owner';
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StewardCaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(async () => {
    if (!flags.stewardWorkspace) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const next = await loadStewardWorkspace(client);
      setSnapshot(next);
      setSelectedId((current) => current && next.cases.some((item) => item.id === current) ? current : next.cases[0]?.id ?? null);
    } catch { setError(t('steward.loadError')); }
    finally { setLoading(false); }
  }, [client, flags.stewardWorkspace, t]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailLoading(false); return; }
    let active = true;
    setDetail(null);
    setDetailLoading(true);
    void loadStewardCaseDetail(client, selectedId)
      .then((value) => { if (active) setDetail(value); })
      .catch(() => { if (active) setError(t('steward.loadError')); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [client, selectedId, t]);

  const selectedCase = snapshot.cases.find((item) => item.id === selectedId) ?? null;
  const drivers = useMemo(() => new Map(snapshot.drivers.map((driver) => [driver.id, driver])), [snapshot.drivers]);
  const races = useMemo(() => new Map(snapshot.races.map((race) => [race.id, race])), [snapshot.races]);
  const counts = useMemo(() => ({
    open: snapshot.cases.filter((item) => item.status === 'under_review').length,
    appealed: snapshot.cases.filter((item) => item.status === 'appealed').length,
    closed: snapshot.cases.filter((item) => item.status === 'closed').length,
  }), [snapshot.cases]);
  const detailCounts = useMemo(() => stewardDetailCounts(detail), [detail]);

  async function runAction(action: () => Promise<unknown>, message: string, selectNewest = false) {
    setBusy(true); setError(null); setNotice(null);
    const actionCaseId = selectedId;
    try {
      await action();
      const [nextSnapshot, nextDetail] = await Promise.all([
        loadStewardWorkspace(client),
        actionCaseId ? loadStewardCaseDetail(client, actionCaseId) : Promise.resolve(null),
      ]);
      setSnapshot(nextSnapshot);
      setSelectedId((current) => selectNewest ? nextSnapshot.cases[0]?.id ?? null : current && nextSnapshot.cases.some((item) => item.id === current) ? current : nextSnapshot.cases[0]?.id ?? null);
      if (selectNewest) setDetail(null);
      else if (actionCaseId) setDetail(nextDetail);
      setNotice(message);
      return true;
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('steward.actionError')); return false; }
    finally { setBusy(false); }
  }

  if (roleLoading) return <AppState copy="Berechtigungen und Steward-Fälle werden geprüft." title={t('pending')} tone="loading" />;
  if (!flags.stewardWorkspace) {
    return <AppState copy={t('steward.deniedCopy')} title={t('steward.deniedTitle')} tone="denied" />;
  }

  return (
    <main className="steward-workspace" id="main-content">
      <header className="steward-heading">
        <div><p className="section-label">{t('steward.eyebrow')}</p><h1>{t('steward.title')}</h1><p>{t('steward.copy')}</p></div>
        {permitted && <button className="primary-action action-button" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? t('steward.cancel') : t('steward.newCase')}</button>}
      </header>

      <section className="case-metrics" aria-label={t('steward.metrics')}>
        <div><strong>{counts.open}</strong><span>{t('steward.open')}</span></div>
        <div><strong>{counts.appealed}</strong><span>{t('steward.appealed')}</span></div>
        <div><strong>{counts.closed}</strong><span>{t('steward.closed')}</span></div>
        <div><strong>{snapshot.cases.length}</strong><span>{t('steward.latest')}</span></div>
      </section>

      {permitted && showCreate && <CreateCaseForm snapshot={snapshot} busy={busy} onSubmit={(input) => void runAction(() => createStewardCase(client, input), t('steward.caseCreated'), true).then((saved) => { if (saved) setShowCreate(false); })} />}
      {error && <p className="workspace-message workspace-message--error" role="alert">{error}</p>}
      {notice && <p className="workspace-message" role="status">{notice}</p>}

      <div className={selectedCase ? 'case-layout' : 'case-layout case-layout--queue-only'}>
        <section className="case-queue" aria-label={t('steward.queue')}>
          <div className="case-section-title"><span>{t('steward.queue')}</span><small>{t('steward.pagination')}</small></div>
          {loading ? <p aria-live="polite" role="status">{t('pending')}</p> : snapshot.cases.length === 0 ? <EmptyState action={permitted ? <button className="text-action" onClick={() => setShowCreate(true)} type="button">{t('steward.newCase')}</button> : undefined} copy={t('steward.empty')} title="Keine Steward-Fälle" /> : snapshot.cases.map((item) => (
            <button key={item.id} type="button" className={item.id === selectedId ? 'case-row case-row--active' : 'case-row'} onClick={() => setSelectedId(item.id)}>
              <span><strong>{item.case_number}</strong><StatusPill value={item.status} /></span>
              <b>{item.title}</b>
              <small>{races.get(item.race_id)?.grand_prix_name ?? t('steward.race')} · {formatDate(item.created_at)}</small>
            </button>
          ))}
        </section>

        {selectedCase && <section className="case-detail" aria-live="polite">
          <>
            <header className="case-detail-heading">
              <div><span>{selectedCase.case_number}</span><h2>{selectedCase.title}</h2></div><StatusPill value={selectedCase.status} />
            </header>
            <dl className="case-facts">
              <div><dt>{t('steward.race')}</dt><dd>{races.get(selectedCase.race_id)?.grand_prix_name ?? '—'}</dd></div>
              <div><dt>{t('steward.accused')}</dt><dd>{drivers.get(selectedCase.accused_driver_id)?.display_name ?? '—'}</dd></div>
              <div><dt>{t('steward.rule')}</dt><dd>{selectedCase.rule_code} · {selectedCase.rule_version}</dd></div>
            </dl>
            <p className="case-description">{selectedCase.description}</p>

            <div className="case-timeline" aria-busy={detailLoading}>
              <DetailBlock title={t('steward.evidence')} count={detailCounts?.evidence ?? null}>{detail?.evidence.map((item) => <article key={item.id}><strong>{item.evidence_kind}</strong><p>{item.description}</p>{item.uri && <a href={item.uri} rel="noreferrer" target="_blank">{t('steward.openEvidence')}</a>}</article>)}</DetailBlock>
              <DetailBlock title={t('steward.votes')} count={detailCounts?.votes ?? null}>{detail?.votes.map((item) => <article key={item.id}><strong>{item.outcome} · v{item.vote_version}</strong>{item.conflict_disclosed && <em>{t('steward.conflict')}</em>}<p>{item.reasoning}</p></article>)}</DetailBlock>
              <DetailBlock title={t('steward.decisions')} count={detailCounts?.decisions ?? null}>{detail?.decisions.map((item) => <article key={item.id}><strong>v{item.version_number} · {item.outcome}</strong><p>{item.reasoning}</p><small>{item.rule_code} · {item.rule_version}</small>{item.result_revision && <div className="result-revision-reference"><span>{t('steward.resultRevision')}</span><strong>V{item.result_revision.resultVersion}</strong><small>{item.result_revision.isCurrent ? t('steward.currentOfficialResult') : t('steward.supersededResult')}</small></div>}{detail.penalties.filter((penalty) => penalty.decision_version_id === item.id).map((penalty) => <p className="penalty-line" key={penalty.id}>{penalty.penalty_type} · {penalty.reason}</p>)}</article>)}</DetailBlock>
              <DetailBlock title={t('steward.appeals')} count={detailCounts?.appeals ?? null}>{detail?.appeals.map((item) => <article key={item.id}><strong>{item.status}</strong><p>{item.reason}</p></article>)}</DetailBlock>
            </div>

            {permitted && selectedCase.status === 'under_review' && <div className="steward-actions">
              <EvidenceForm busy={busy} onSubmit={(input) => runAction(() => addStewardEvidence(client, { ...input, caseId: selectedCase.id }), t('steward.evidenceAdded'))} />
              <VoteForm busy={busy} onSubmit={(input) => runAction(() => castStewardVote(client, { ...input, caseId: selectedCase.id }), t('steward.voteSaved'))} />
              <DecisionForm busy={busy} accusedDriverId={selectedCase.accused_driver_id} ruleCode={selectedCase.rule_code} ruleVersion={selectedCase.rule_version} onSubmit={(input) => runAction(() => finalizeStewardDecision(client, { ...input, caseId: selectedCase.id }), t('steward.decisionFinalized'))} />
            </div>}
          </>
        </section>}
      </div>
    </main>
  );
}

function DetailBlock({ title, count, children }: { title: string; count: number | null; children: React.ReactNode }) {
  return <section><h3>{title}<span aria-live="polite">{count ?? '…'}</span></h3><div>{children}</div></section>;
}

function CreateCaseForm({ snapshot, busy, onSubmit }: { snapshot: StewardWorkspaceSnapshot; busy: boolean; onSubmit: (input: Parameters<typeof createStewardCase>[1]) => void }) {
  const { t } = useI18n();
  const availableRaces = activeStewardRaces(snapshot);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    onSubmit({ raceId: String(data.get('race')), reportedDriverId: String(data.get('reporter')) || null, accusedDriverId: String(data.get('accused')), title: String(data.get('title')), description: String(data.get('description')), ruleCode: String(data.get('ruleCode')), ruleVersion: String(data.get('ruleVersion')) });
  }
  return <form className="steward-form steward-form--create" onSubmit={submit}><h2>{t('steward.newCase')}</h2><label>{t('steward.race')}<select name="race" required>{availableRaces.map((race) => <option value={race.id} key={race.id}>{race.round_number}. {race.grand_prix_name}</option>)}</select></label><label>{t('steward.accused')}<select name="accused" required>{snapshot.drivers.map((driver) => <option value={driver.id} key={driver.id}>{driver.display_name}</option>)}</select></label><label>{t('steward.reporter')}<select name="reporter"><option value="">—</option>{snapshot.drivers.map((driver) => <option value={driver.id} key={driver.id}>{driver.display_name}</option>)}</select></label><label>{t('steward.caseTitle')}<input name="title" minLength={4} maxLength={140} required /></label><label className="span-two">{t('steward.description')}<textarea name="description" minLength={10} maxLength={4000} required /></label><label>{t('steward.ruleCode')}<input name="ruleCode" required /></label><label>{t('steward.ruleVersion')}<input name="ruleVersion" required /></label><button className="primary-action action-button" disabled={busy || !availableRaces.length} type="submit">{t('steward.create')}</button></form>;
}

function EvidenceForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: { kind: string; uri: string; description: string; isPublic: boolean }) => void }) {
  const { t } = useI18n();
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ kind: String(data.get('kind')), uri: String(data.get('uri')), description: String(data.get('description')), isPublic: data.get('public') === 'on' }); event.currentTarget.reset(); }
  return <form className="steward-form" onSubmit={submit}><h3>{t('steward.addEvidence')}</h3><label>{t('steward.kind')}<select name="kind"><option value="video">Video</option><option value="image">Bild</option><option value="telemetry">Telemetry</option><option value="statement">Statement</option><option value="document">Document</option></select></label><label>{t('steward.link')}<input name="uri" type="url" /></label><label>{t('steward.description')}<textarea name="description" minLength={3} required /></label><label className="check-label"><input name="public" type="checkbox" />{t('steward.publicEvidence')}</label><button className="text-action" disabled={busy}>{t('steward.save')}</button></form>;
}

function VoteForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: { outcome: string; reasoning: string; conflict: boolean }) => void }) {
  const { t } = useI18n();
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ outcome: String(data.get('outcome')), reasoning: String(data.get('reasoning')), conflict: data.get('conflict') === 'on' }); }
  return <form className="steward-form" onSubmit={submit}><h3>{t('steward.castVote')}</h3><label>{t('steward.outcome')}<select name="outcome"><option value="no_action">No action</option><option value="warning">Warning</option><option value="penalty">Penalty</option><option value="dismissed">Dismissed</option></select></label><label>{t('steward.reasoning')}<textarea name="reasoning" minLength={5} required /></label><label className="check-label"><input name="conflict" type="checkbox" />{t('steward.conflictCheck')}</label><button className="text-action" disabled={busy}>{t('steward.vote')}</button></form>;
}

function DecisionForm({ busy, accusedDriverId, ruleCode, ruleVersion, onSubmit }: { busy: boolean; accusedDriverId: string; ruleCode: string; ruleVersion: string; onSubmit: (input: Omit<Parameters<typeof finalizeStewardDecision>[1], 'caseId'>) => void }) {
  const { t } = useI18n();
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const outcome = String(data.get('outcome')); const penaltyType = String(data.get('penaltyType')); const amount = Number(data.get('amount')); const penalties = outcome === 'penalty' ? [{ driver_id: accusedDriverId, penalty_type: penaltyType, ...(penaltyType === 'time_penalty' ? { time_delta_ms: amount * 1000 } : {}), ...(penaltyType === 'points_penalty' ? { points_delta: -Math.abs(amount) } : {}), reason: String(data.get('penaltyReason')) }] : []; onSubmit({ outcome, reasoning: String(data.get('reasoning')), ruleCode, ruleVersion, penalties }); }
  return <form className="steward-form steward-form--decision" onSubmit={submit}><h3>{t('steward.finalDecision')}</h3><label>{t('steward.outcome')}<select name="outcome"><option value="no_action">No action</option><option value="warning">Warning</option><option value="penalty">Penalty</option><option value="dismissed">Dismissed</option></select></label><label>{t('steward.penaltyType')}<select name="penaltyType"><option value="time_penalty">Time penalty</option><option value="points_penalty">Points penalty</option><option value="warning">Warning</option><option value="disqualification">Disqualification</option></select></label><label>{t('steward.amount')}<input name="amount" min="0" step="0.01" type="number" defaultValue="5" /></label><label>{t('steward.penaltyReason')}<input name="penaltyReason" minLength={3} defaultValue={ruleCode} /></label><label className="span-two">{t('steward.reasoning')}<textarea name="reasoning" minLength={10} required /></label><p className="decision-warning span-two">{t('steward.finalWarning')}</p><button className="primary-action action-button" disabled={busy} type="submit">{t('steward.finalize')}</button></form>;
}
