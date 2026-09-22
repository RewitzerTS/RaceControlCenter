import { useEffect, useRef, useState, type FormEvent, type PropsWithChildren } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { ownerMfaMessages } from './ownerMfaMessages';
import './owner-mfa.css';

const FACTOR_NAME = 'RaceVora Owner';
type Factor = { id: string; friendly_name?: string };
type Enrollment = { id: string; qr: string; secret: string };
type Check = { token: string; state: 'allowed' | 'required' | 'error' };

export function parseOwnerMfaStatus(value: unknown): { is_owner: boolean; verified: boolean } {
  if (!value || typeof value !== 'object' || !('is_owner' in value) || !('verified' in value)
      || typeof value.is_owner !== 'boolean' || typeof value.verified !== 'boolean'
      || (!value.is_owner && value.verified)) throw new Error('Invalid security response');
  return { is_owner: value.is_owner, verified: value.verified };
}

export function OwnerMfaGate({ client, children, production = false }: PropsWithChildren<{ client: LeagueSupabaseClient; production?: boolean }>) {
  const { user, loading, session, signOut } = useAuth();
  const { language } = useI18n();
  if (loading) return <main className="owner-mfa"><p role="status">{ownerMfaMessages[language].checking}</p></main>;
  if (!user) return children;
  // A user switch discards every previous check, QR and pending UI operation.
  return <OwnerMfaSession key={user.id} client={client} token={session?.access_token ?? ''} signOut={signOut} production={production}>{children}</OwnerMfaSession>;
}

export function OwnerMfaSession({ client, token, signOut, children, production = false }: PropsWithChildren<{
  client: LeagueSupabaseClient; token: string; signOut: () => Promise<void>; production?: boolean;
}>) {
  const { language } = useI18n();
  const copy = ownerMfaMessages[language];
  const [check, setCheck] = useState<Check | null>(null);
  const [retry, setRetry] = useState(0);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [backupSaved, setBackupSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof typeof copy | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    let active = true;
    setCheck(null);
    async function load() {
      try {
        if (!token) throw new Error('Session missing');
        const result = await client.rpc('get_owner_mfa_status');
        if (result.error) throw result.error;
        const status = parseOwnerMfaStatus(result.data);
        if (!active) return;
        if (!status.is_owner || status.verified) {
          setEnrollment(null);
          setCheck({ token, state: 'allowed' });
          return;
        }
        const listed = await client.auth.mfa.listFactors();
        if (listed.error) throw listed.error;
        if (!active) return;
        const verified = listed.data.totp.filter((factor) => factor.status === 'verified');
        setFactors(verified);
        setFactorId((previous) => verified.some((factor) => factor.id === previous) ? previous : verified[0]?.id ?? '');
        setCheck({ token, state: 'required' });
      } catch {
        if (active) setCheck({ token, state: 'error' });
      }
    }
    void load();
    return () => { active = false; };
  }, [client, token, retry]);

  async function run(action: () => Promise<void>, failure: keyof typeof copy) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try { await action(); }
    catch { if (mounted.current) setError(failure); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }

  function enroll() {
    void run(async () => {
      setEnrollment(null);
      setCode('');
      setBackupSaved(false);
      const listed = await client.auth.mfa.listFactors();
      if (listed.error) throw listed.error;
      // Never delete verified factors or another application's pending setup.
      for (const factor of listed.data.all) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified' && factor.friendly_name === FACTOR_NAME) {
          if (!mounted.current) return;
          const removed = await client.auth.mfa.unenroll({ factorId: factor.id });
          if (removed.error) throw removed.error;
        }
      }
      if (!mounted.current) return;
      const result = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: FACTOR_NAME, issuer: production ? 'RaceVora' : 'RaceVora Staging' });
      if (result.error) throw result.error;
      if (mounted.current) setEnrollment({ id: result.data.id, qr: result.data.totp.qr_code, secret: result.data.totp.secret });
    }, 'setupError');
  }

  function verify(event: FormEvent) {
    event.preventDefault();
    const normalized = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalized)) { setError('invalid'); return; }
    const id = enrollment?.id ?? factorId;
    if (!id || (enrollment && !backupSaved)) return;
    void run(async () => {
      const result = await client.auth.mfa.challengeAndVerify({ factorId: id, code: normalized });
      if (result.error) throw result.error;
      if (!mounted.current) return;
      setCode('');
      setEnrollment(null);
      // AuthProvider receives the upgraded session. Recheck on the server;
      // a successful client-side verification alone never unlocks children.
      setCheck(null);
      setRetry((value) => value + 1);
    }, 'verifyError');
  }

  const state = check?.token === token ? check.state : 'checking';
  if (state === 'allowed') return children;
  const setup = factors.length === 0;
  return (
    <main className="owner-mfa" id="main-content">
      <section className="owner-mfa-panel" aria-labelledby="owner-mfa-title" aria-busy={busy}>
        <p className="hero-kicker">{copy.kicker}{!production && ' · Staging'}</p>
        <h1 id="owner-mfa-title">{state === 'required' && setup ? copy.setupTitle : copy.title}</h1>
        {state === 'checking' && <p role="status">{copy.checking}</p>}
        {state === 'error' && <><p role="alert">{copy.failed}</p><button className="primary-action" onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button></>}
        {state === 'required' && <>
          <p>{setup ? copy.setup : copy.prompt}</p>
          {setup && !enrollment && <>
            <button className="primary-action" disabled={busy} onClick={enroll}>{busy ? copy.busy : copy.start}</button>
            <p className="owner-mfa-note">{copy.replace}</p>
          </>}
          {enrollment && <>
            <p>{copy.scan}</p>
            <img className="owner-mfa-qr" src={enrollment.qr} alt={copy.qr} width="224" height="224" />
            <details className="owner-mfa-key"><summary>{copy.secret}</summary><code>{enrollment.secret}</code><p>{copy.backup}</p></details>
          </>}
          {(enrollment || factors.length > 0) && <form onSubmit={verify}>
            {factors.length > 1 && <><label htmlFor="owner-mfa-device">{copy.device}</label><select id="owner-mfa-device" value={factorId} disabled={busy} onChange={(event) => { setFactorId(event.target.value); setCode(''); setError(null); }}>{factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Authenticator ${index + 1}`}</option>)}</select></>}
            {enrollment && <label className="owner-mfa-backup"><input type="checkbox" checked={backupSaved} disabled={busy} onChange={(event) => setBackupSaved(event.target.checked)} /><span>{copy.saved}</span></label>}
            <label htmlFor="owner-mfa-code">{copy.code}</label>
            <input id="owner-mfa-code" name="one-time-code" type="text" inputMode="numeric" autoComplete="one-time-code" spellCheck={false} autoCapitalize="off" maxLength={7} value={code} disabled={busy} required aria-invalid={error === 'invalid' || error === 'verifyError'} aria-describedby={error ? 'owner-mfa-error' : undefined} onChange={(event) => { setCode(event.target.value); setError(null); }} />
            <button type="submit" className="primary-action" disabled={busy || (Boolean(enrollment) && !backupSaved)}>{busy ? copy.busy : copy.confirm}</button>
          </form>}
          {enrollment && <button className="text-action" disabled={busy} onClick={enroll}>{copy.restart}</button>}
          <details className="owner-mfa-recovery"><summary>{copy.recoveryTitle}</summary><p>{copy.recovery}</p></details>
        </>}
        {error && <p id="owner-mfa-error" className="owner-mfa-error" role="alert">{copy[error]}</p>}
        <button className="text-action owner-mfa-signout" disabled={busy} onClick={() => void run(signOut, 'signOutError')}>{copy.signOut}</button>
      </section>
    </main>
  );
}
