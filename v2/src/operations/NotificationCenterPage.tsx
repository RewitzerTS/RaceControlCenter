import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AppState, EmptyState } from '../components/AppState';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { loadInbox, markAllInboxRead, markInboxItemRead, type InboxNotification } from './operations';
import { notificationPresentation } from './notificationPresentation';
import { INBOX_CHANGED, useUnreadNotifications } from './useUnreadNotifications';
import { notificationActions } from './notificationActions';
import './notificationActions.css';

export function NotificationCenterPage() {
  const { user } = useAuth();
  const { leagueSlug } = useLeague();
  return <NotificationCenter key={`${user?.id ?? 'signed-out'}:${leagueSlug}`} />;
}

function NotificationCenter() {
  const { user } = useAuth();
  const { client } = useLeague();
  const { formatDate, formatTime, t, language } = useI18n();
  const c = notificationActions[language];
  const [items, setItems] = useState<InboxNotification[] | null>(null);
  const [error, setError] = useState(false);
  const [bulkError, setBulkError] = useState(false), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const unread = useUnreadNotifications(client, user?.id ?? null);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    let active = true;
    setItems(null); setError(false);
    void loadInbox(client).then((data) => { if (active) setItems(data); }).catch(() => { if (active) { setError(true); setItems([]); } });
    return () => { active = false; };
  }, [client, user]);

  async function markRead(item: InboxNotification) {
    if (item.read_at) return;
    try {
      await markInboxItemRead(client, item.id);
      window.dispatchEvent(new Event(INBOX_CHANGED));
      setItems((current) => current?.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry) ?? []);
    } catch { setError(true); }
  }

  async function markAllRead() {
    if (!user || inFlight.current) return;
    inFlight.current = true; setBusy(true); setBulkError(false); setDone(false);
    try {
      const markedAt = await markAllInboxRead(client);
      setItems((current) => current?.map((item) => !item.read_at && Date.parse(item.created_at) <= Date.parse(markedAt) ? { ...item, read_at: markedAt } : item) ?? []);
      window.dispatchEvent(new Event(INBOX_CHANGED));
      setDone(true);
    } catch { setBulkError(true); }
    finally { inFlight.current = false; setBusy(false); }
  }

  if (items === null) return <AppState copy="Deine aktuellen Hinweise werden geladen." title={t('pending')} tone="loading" />;
  return <main className="operations-page notification-page" id="main-content">
    <header className="operations-header"><div><h1>{t('notification.title')}</h1><p>{t('notification.copy')}</p></div>
      {user && <button className="text-action notification-mark-all" type="button" disabled={busy || (!bulkError && unread === 0 && !items.some((item) => !item.read_at))} onClick={() => void markAllRead()}>{busy ? c.busy : c.all}</button>}
    </header>
    {bulkError && <p className="inline-error" role="alert">{c.error}</p>}
    {done && <p role="status">{c.success}</p>}
    {error && <p className="inline-error" role="alert">{t('notification.error')}</p>}
    {!user ? <EmptyState copy={t('notification.signedOut')} title="Keine Benachrichtigungen" /> : items.length === 0 ? <EmptyState copy={t('notification.empty')} title="Alles erledigt" /> : <ol className="notification-list">{items.map((item) => <NotificationItem formatDate={formatDate} formatTime={formatTime} item={item} key={item.id} markRead={markRead} t={t} />)}</ol>}
  </main>;
}

function NotificationItem({ item, markRead, t, formatDate, formatTime }: {
  item: InboxNotification;
  markRead: (item: InboxNotification) => Promise<void>;
  t: ReturnType<typeof useI18n>['t'];
  formatDate: ReturnType<typeof useI18n>['formatDate'];
  formatTime: ReturnType<typeof useI18n>['formatTime'];
}) {
  const presentation = notificationPresentation(item);
  const content = <><span className="notification-dot" aria-hidden="true" /><span className="notification-copy"><span className="notification-meta"><small>{t(presentation.categoryKey)}</small>{presentation.reference && <b>{presentation.reference}</b>}</span><strong>{t(item.title_key as never)}</strong><small>{t(item.body_key as never, presentation.params)}</small></span><time dateTime={item.created_at}>{formatDate(item.created_at)} · {formatTime(item.created_at)}</time></>;
  return <li className={item.read_at ? '' : 'notification-unread'}>{presentation.target
    ? <NavLink to={presentation.target} onClick={() => void markRead(item)}>{content}</NavLink>
    : <button type="button" onClick={() => void markRead(item)}>{content}</button>}
  </li>;
}
