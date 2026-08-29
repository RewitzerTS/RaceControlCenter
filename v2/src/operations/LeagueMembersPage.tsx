import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AppState, EmptyState } from '../components/AppState';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import {
  addLeagueMember,
  loadMemberAdminWorkspace,
  removeLeagueMember,
  reviewLeagueJoinRequest,
  setLeagueMemberRole,
  type LeagueMemberRole,
  type MemberAdminWorkspace,
} from './operations';

const ROLE_LABEL_KEYS: Record<LeagueMemberRole, MessageKey> = {
  driver: 'driverRole',
  steward: 'stewardRole',
  league_admin: 'leagueAdminRole',
};

export function LeagueMembersPage() {
  const { client, leagueSlug } = useLeague();
  const { role } = useRole();
  const { formatDate, formatTime, t } = useI18n();
  const [workspace, setWorkspace] = useState<MemberAdminWorkspace | null>(null);
  const [email, setEmail] = useState('');
  const [memberRole, setMemberRole] = useState<LeagueMemberRole>('driver');
  const [busyId, setBusyId] = useState('');
  const [confirmRemove, setConfirmRemove] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const allowed = role === 'league_admin' || role === 'platform_owner';
  const requestDate = (value: string) => `${formatDate(value)} · ${formatTime(value)}`;

  const reload = useCallback(async () => {
    const data = await loadMemberAdminWorkspace(client);
    setWorkspace(data);
  }, [client]);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void loadMemberAdminWorkspace(client)
      .then((data) => { if (active) setWorkspace(data); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Mitglieder konnten nicht geladen werden.'); });
    return () => { active = false; };
  }, [allowed, client]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError(''); setSaved(''); setBusyId('add');
    try {
      await addLeagueMember(client, email, memberRole);
      await reload();
      setEmail('');
      setSaved('Mitglied und Berechtigung wurden gespeichert.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Mitglied konnte nicht hinzugefügt werden.'); }
    finally { setBusyId(''); }
  }

  async function changeRole(userId: string, nextRole: LeagueMemberRole) {
    setError(''); setSaved(''); setBusyId(userId);
    try {
      await setLeagueMemberRole(client, userId, nextRole);
      await reload();
      setSaved('Berechtigung wurde aktualisiert.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Berechtigung konnte nicht geändert werden.'); }
    finally { setBusyId(''); }
  }

  async function remove(userId: string) {
    setError(''); setSaved(''); setBusyId(userId);
    try {
      await removeLeagueMember(client, userId);
      await reload();
      setConfirmRemove('');
      setSaved('Mitglied wurde aus der Liga entfernt.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Mitglied konnte nicht entfernt werden.'); }
    finally { setBusyId(''); }
  }

  async function review(requestId: string, decision: 'approved' | 'rejected') {
    setError(''); setSaved(''); setBusyId(requestId);
    try {
      await reviewLeagueJoinRequest(client, requestId, decision);
      await reload();
      setSaved(decision === 'approved' ? 'Beitrittsanfrage wurde angenommen.' : 'Beitrittsanfrage wurde abgelehnt.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Beitrittsanfrage konnte nicht bearbeitet werden.'); }
    finally { setBusyId(''); }
  }

  if (!allowed) return <AppState copy="Du benötigst die Rolle Ligaleitung, um Mitglieder und Berechtigungen zu verwalten." title="Zugriff verweigert" tone="denied" />;
  if (!workspace && !error) return <AppState copy="Mitglieder, Rollen und offene Beitrittsanfragen werden geladen." title="Benutzer werden geladen" tone="loading" />;
  if (!workspace && error) return <AppState action={<button className="text-action" onClick={() => { setError(''); void reload().catch((reason) => setError(reason instanceof Error ? reason.message : 'Mitglieder konnten nicht geladen werden.')); }} type="button">Erneut versuchen</button>} copy={error} title="Mitglieder konnten nicht geladen werden" tone="error" />;

  return <main className="operations-page admin-management-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">Ligaleitung · {leagueSlug}</p><h1>Benutzer &amp; Berechtigungen</h1><p>Registrierte RaceVora-Konten der Liga zuordnen und ihre Rolle festlegen. Änderungen gelten ausschließlich für <strong>{leagueSlug}</strong>.</p></div><NavLink className="text-link" to="/admin">Zur Ligaleitung</NavLink></header>
    <form className="admin-inline-form" onSubmit={(event) => void add(event)}>
      <label><span>E-Mail des RaceVora-Kontos</span><input autoComplete="email" maxLength={254} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label><span>Rolle</span><select value={memberRole} onChange={(event) => setMemberRole(event.target.value as LeagueMemberRole)}>{Object.entries(ROLE_LABEL_KEYS).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}</select></label>
      <button className="primary-action" disabled={busyId === 'add'} type="submit">{busyId === 'add' ? 'Hinzufügen …' : 'Mitglied hinzufügen'}</button>
    </form>
    <p className="admin-help">Das Konto muss sich zuvor einmal bei RaceVora registriert haben. Für neue Konten wird kein Passwort durch die Ligaleitung vergeben.</p>
    {error && <p className="inline-error" role="alert">{error}</p>}{saved && <p className="inline-success" role="status">{saved}</p>}
    <section className="admin-data-panel join-request-panel" aria-labelledby="join-request-title">
      <div className="admin-panel-heading"><div><p className="section-label">Neue Anfragen</p><h2 id="join-request-title">Liga-Beitritt prüfen</h2></div><strong>{workspace?.join_requests.length ?? 0}</strong></div>
      {workspace?.join_requests.length ? <div className="join-request-list">{workspace.join_requests.map((request) => <article className="join-request-card" key={request.id}><div className="join-request-person"><span className="join-request-avatar" aria-hidden="true">{request.display_name.slice(0, 1).toUpperCase()}</span><div><h3>{request.display_name}</h3><p>{request.gamertag}</p><small>{request.email}{request.real_name ? ` · ${request.real_name}` : ''}{request.nationality_code ? ` · ${request.nationality_code}` : ''}</small><span className="join-request-waiting">Wartet seit {requestDate(request.requested_at)}</span></div></div><div className="join-request-actions"><button className="primary-action" disabled={busyId === request.id} onClick={() => void review(request.id, 'approved')} type="button">Annehmen</button><button className="text-action" disabled={busyId === request.id} onClick={() => void review(request.id, 'rejected')} type="button">Ablehnen</button></div></article>)}</div> : <EmptyState copy="Neue Nutzer können beim Einrichten ihres Kontos mit der Liga-ID eine Beitrittsanfrage senden." title="Keine offenen Anfragen" />}
    </section>
    <section className="admin-data-panel" aria-labelledby="member-list-title">
      <div className="admin-panel-heading"><div><p className="section-label">Aktive Zuordnungen</p><h2 id="member-list-title">Liga-Mitglieder</h2></div><strong>{workspace?.members.length ?? 0}</strong></div>
      {workspace?.members.length ? <div className="responsive-table responsive-table--records"><table><thead><tr><th>Mitglied</th><th>Fahrerprofil</th><th>Rolle</th><th>Aktion</th></tr></thead><tbody>{workspace.members.map((member) => <tr key={member.user_id}><td data-label="Mitglied" data-mobile-primary="true"><strong>{member.email}</strong><small>{member.identity_status === 'active' ? 'Konto aktiv' : member.identity_status}</small></td><td data-label="Fahrerprofil">{member.driver_name ?? 'Noch nicht verknüpft'}</td><td data-label="Rolle"><select aria-label={`Rolle für ${member.email}`} disabled={busyId === member.user_id} value={member.role} onChange={(event) => void changeRole(member.user_id, event.target.value as LeagueMemberRole)}>{Object.entries(ROLE_LABEL_KEYS).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}</select></td><td data-label="Aktion">{confirmRemove === member.user_id ? <span className="confirm-actions"><button disabled={busyId === member.user_id} onClick={() => void remove(member.user_id)} type="button">Ja, entfernen</button><button onClick={() => setConfirmRemove('')} type="button">Abbrechen</button></span> : <button className="danger-action" onClick={() => setConfirmRemove(member.user_id)} type="button">Entfernen</button>}</td></tr>)}</tbody></table></div> : <EmptyState copy="Füge oben ein bereits registriertes Konto hinzu. Bestehende Ligen bleiben davon unabhängig." title="Noch keine Liga-Mitglieder" />}
    </section>
  </main>;
}
