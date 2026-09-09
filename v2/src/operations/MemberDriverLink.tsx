import { useEffect, useRef, useState } from 'react';
import type { LeagueSupabaseClient } from '../lib/supabase';
import type { LeagueMember } from './operations';
import { linkMemberDriver, loadLinkableDrivers, memberDriverLinkError, type LinkableDriver } from './driverLinkApi';
import './member-driver-link.css';

export function MemberDriverLink({ client, member, onLinked }: { client: LeagueSupabaseClient; member: LeagueMember; onLinked: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [drivers, setDrivers] = useState<LinkableDriver[]>([]);
  const [selected, setSelected] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    if (!open) return;
    setState('loading'); setError(''); setSelected(''); setDrivers([]);
    void loadLinkableDrivers(client).then((items) => {
      if (generation.current !== current) return;
      setDrivers(items); setState('idle');
      requestAnimationFrame(() => select.current?.focus());
    }).catch((reason) => {
      if (generation.current !== current) return;
      setError(memberDriverLinkError(reason)); setState('idle');
    });
    return () => { generation.current++; };
  }, [client, open, attempt]);

  if (member.driver_id) return <span>{member.driver_name ?? 'Fahrer verknüpft'}</span>;
  if (state === 'saved') return <span role="status">Fahrer verknüpft. Bitte lade die Seite neu, falls die Liste noch nicht aktualisiert ist.</span>;
  const driver = drivers.find((item) => item.id === selected);
  async function save() {
    if (!driver || state === 'saving') return;
    setState('saving'); setError('');
    try {
      await linkMemberDriver(client, member.user_id, driver.id);
    } catch (reason) { setError(memberDriverLinkError(reason)); setState('idle'); return; }
    setState('saved');
    // A failed refresh must not present a committed link as a failed write.
    await onLinked().catch(() => undefined);
  }
  return <div className="member-driver-link">
    {!open ? <><span>Noch nicht verknüpft</span><button ref={trigger} className="text-action" type="button" disabled={member.identity_status !== 'active'} onClick={() => setOpen(true)}>Fahrer verknüpfen</button>{member.identity_status !== 'active' && <small>Aktives RaceVora-Profil erforderlich.</small>}</> :
      <form aria-label={`Fahrer für ${member.email} verknüpfen`} onSubmit={(event) => { event.preventDefault(); void save(); }}>
        {state === 'loading' ? <p role="status">Fahrer werden geladen …</p> : <>
          {drivers.length > 0 && <label><span>Bestehender Fahrer</span><select ref={select} value={selected} required disabled={state === 'saving'} onChange={(event) => setSelected(event.target.value)}><option value="">Bitte auswählen</option>{drivers.map((item) => <option key={item.id} value={item.id}>{item.display_name}{item.gamertag ? ` / ${item.gamertag}` : ''}{item.number !== null ? ` · #${item.number}` : ''}{!item.is_active ? ' · Inaktiv' : ''}</option>)}</select></label>}
          {!drivers.length && !error && <p>Keine unverknüpften Fahrer in dieser Liga vorhanden.</p>}
          {driver && <p className="member-driver-confirm">Du verknüpfst <strong>{member.email}</strong> mit <strong>{driver.display_name}</strong>. Ergebnisse und Historie bleiben beim bestehenden Fahrer.</p>}
          {error && <p role="alert">{error}</p>}
          <div className="member-driver-actions">
            {driver && <button className="primary-action" type="submit" disabled={state === 'saving'}>{state === 'saving' ? 'Wird verknüpft …' : 'Verknüpfung bestätigen'}</button>}
            {error && <button className="text-action" type="button" disabled={state === 'saving'} onClick={() => setAttempt((value) => value + 1)}>Auswahl neu laden</button>}
          </div>
        </>}
        <button className="text-action" type="button" disabled={state === 'saving'} onClick={() => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }}>Abbrechen</button>
      </form>}
  </div>;
}
