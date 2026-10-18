import { type FormEvent, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { activeStewardRaces, nextStewardRace, stewardParticipantIds, type GroupStewardInput, type SimplePenaltyType, type StewardCase, type StewardWorkspaceSnapshot } from './stewardWorkspace';
import { simpleStewardMessages } from './simpleStewardMessages';

export function GroupDecisionForm({ snapshot, existing, busy, onSubmit, submissionError }: {
  snapshot: StewardWorkspaceSnapshot; existing?: StewardCase; busy: boolean;
  submissionError?: string | null;
  onSubmit: (input: GroupStewardInput, key: string, draft: boolean) => Promise<boolean>;
}) {
  const { t, language } = useI18n(), c = simpleStewardMessages[language];
  const races = existing ? snapshot.races.filter((r) => r.id === existing.race_id) : activeStewardRaces(snapshot);
  const [raceId, setRaceId] = useState(existing?.race_id || races[0]?.id || '');
  const [reporters, setReporters] = useState(existing ? stewardParticipantIds(existing, 'reporter') : ['']);
  const [accused, setAccused] = useState(existing ? stewardParticipantIds(existing, 'accused') : ['']);
  const [kinds, setKinds] = useState<Record<string, SimplePenaltyType>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const retry = useRef<{ payload: string; key: string } | null>(null), pending = useRef(false);
  const race = snapshot.races.find((r) => r.id === raceId), next = nextStewardRace(snapshot.races, raceId);
  const kindFor = (id: string) => kinds[id] || 'time_penalty';
  const canPublish = Boolean(race && accused.every((id) => kindFor(id) !== 'grid_penalty' || next));
  const name = (id: string) => snapshot.drivers.find((d) => d.id === id)?.display_name || '—';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current || busy) return;
    const form = event.currentTarget, data = new FormData(form);
    const draft = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'draft';
    const title = existing?.title || String(data.get('title') || '').trim();
    const description = String(data.get('reasoning') || '').trim();
    if (!raceId || !reporters.length || !accused.length || [...reporters, ...accused].some((id) => !id)
      || title.length < 4 || description.length < 10) {
      setLocalError(c.selectParticipants); return;
    }
    if (!draft && (!canPublish || data.get('confirmed') !== 'on')) {
      setLocalError(!canPublish ? c.noNext : c.confirmRequired);
      form.querySelector<HTMLInputElement>('[name="confirmed"]')?.focus(); return;
    }
    const input: GroupStewardInput = { raceId, reporterIds: reporters, accusedIds: accused, title, description, caseId: existing?.id || null,
      decisions: draft ? [] : accused.map((id) => ({ driver_id: id, penalty_type: kindFor(id),
        amount: kindFor(id) === 'no_action' ? null : Number(data.get(`amount-${id}`)),
        target_race_id: kindFor(id) === 'grid_penalty' ? next?.id || null : null,
        reasoning: String(data.get(`reason-${id}`) || '').trim() })) };
    setLocalError(null);
    const payload = JSON.stringify({ input, draft });
    if (retry.current?.payload !== payload) retry.current = { payload, key: crypto.randomUUID() };
    pending.current = true;
    try { if (await onSubmit(input, retry.current.key, draft)) retry.current = null; }
    finally { pending.current = false; }
  }

  function participants(role: 'reporter' | 'accused', ids: string[], setIds: (ids: string[]) => void) {
    const label = role === 'reporter' ? c.reporters : c.accusedDrivers;
    return <fieldset className="steward-participants" disabled={busy}>
      <legend>{label}</legend>
      {existing ? <ul>{ids.map((id) => <li key={id}>{name(id)}</li>)}</ul> : <>
        {ids.map((id, index) => <div className="steward-participant-row" key={index}>
          <select name={index ? `${role}-${index}` : role} aria-label={`${label} ${index + 1}`} value={id} required
            onChange={(event) => setIds(ids.map((value, i) => i === index ? event.target.value : value))}>
            <option value="" disabled>{c.choose}</option>
            {snapshot.drivers.map((driver) => <option key={driver.id} value={driver.id} disabled={ids.includes(driver.id) && id !== driver.id}>{driver.display_name}</option>)}
          </select>
          {ids.length > 1 && <button type="button" className="text-action" aria-label={`${c.removeDriver}: ${id ? name(id) : label + ' ' + (index + 1)}`}
            onClick={() => setIds(ids.filter((_, i) => i !== index))}>{c.removeDriver}</button>}
        </div>)}
        <button type="button" className="text-action" disabled={ids.includes('') || ids.length >= Math.min(snapshot.drivers.length, 100)}
          onClick={() => setIds([...ids, ''])}>{c.addDriver}</button>
      </>}
    </fieldset>;
  }

  return <form className="steward-form steward-form--create simple-steward-form" onSubmit={submit}>
    <h2 className="span-two">{existing ? c.open : t('steward.newCase')}</h2>
    {!existing && <label className="span-two">{t('steward.race')}<select name="race" value={raceId} disabled={busy} required onChange={(e) => setRaceId(e.target.value)}>
      {races.map((r) => <option key={r.id} value={r.id}>{r.round_number}. {r.grand_prix_name}</option>)}
    </select></label>}
    {participants('reporter', reporters, setReporters)}
    {participants('accused', accused, setAccused)}
    <p className="span-two">{c.selfReport}</p>
    {!existing && <label className="span-two">{t('steward.caseTitle')}<input name="title" minLength={4} maxLength={140} required disabled={busy} /></label>}
    <label className="span-two">{c.incident}<textarea name="reasoning" defaultValue={existing?.description || ''} minLength={10} maxLength={4000} required disabled={busy} /></label>
    {accused.some(Boolean) && <div className="span-two"><h3>{c.individualDecisions}</h3><p>{c.oneDecision}</p></div>}
    {accused.filter(Boolean).map((id) => {
      const kind = kindFor(id);
      return <fieldset className="steward-driver-decision span-two" key={id} disabled={busy} data-driver-id={id}>
        <legend>{name(id)}</legend>
        <div className="steward-decision-fields">
          <label>{c.decision}<select name={`penaltyType-${id}`} value={kind} onChange={(e) => setKinds({ ...kinds, [id]: e.target.value as SimplePenaltyType })}>
            {(['time_penalty', 'time_credit', 'grid_penalty', 'no_action'] as const).map((value) => <option key={value} value={value}>{c[value]}</option>)}
          </select></label>
          {kind !== 'no_action' && <label>{kind === 'grid_penalty' ? c.places : c.seconds}<input key={kind} name={`amount-${id}`} type="number"
            min={kind === 'grid_penalty' ? 1 : 0.001} max={kind === 'grid_penalty' ? 99 : 3600} step={kind === 'grid_penalty' ? 1 : 0.001} defaultValue={5} required /></label>}
          <label className="span-two">{c.driverReason}<textarea name={`reason-${id}`} minLength={10} maxLength={4000} required /></label>
        </div>
        {kind === 'grid_penalty' ? <p role="status">{next ? <><strong>{c.target}: {next.round_number}. {next.grand_prix_name}</strong><br />{c.gridHint}</> : c.noNext}</p>
          : kind !== 'no_action' && <p role="status">{race?.current_result_version_id ? c.timeHint : c.noResult}</p>}
      </fieldset>;
    })}
    <label className="check-label span-two"><input name="confirmed" type="checkbox" disabled={busy} />{c.confirm}</label>
    {localError && <p className="span-two" role="alert">{localError}</p>}
    {submissionError && <p className="workspace-message workspace-message--error span-two" role="alert">{submissionError}</p>}
    <div className="simple-steward-submit span-two">
      <button className="primary-action action-button" type="submit" disabled={busy || !canPublish}>{busy ? t('pending') : c.publish}</button>
      {!existing && <button className="text-action" type="submit" value="draft" formNoValidate disabled={busy || !raceId}>{c.draft}</button>}
    </div>
  </form>;
}
