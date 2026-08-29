import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AppState, EmptyState } from '../components/AppState';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { loadInbox, markInboxItemRead, type InboxNotification } from './operations';
import { notificationPresentation } from './notificationPresentation';

export function NotificationCenterPage() {
  const { user } = useAuth();
  const { client } = useLeague();
  const { formatDate, formatTime, t } = useI18n();
  const [items, setItems] = useState<InboxNotification[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    let active = true;
    void loadInbox(client).then((data) => { if (active) setItems(data); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [client, user]);

  async function markRead(item: InboxNotification) {
    if (item.read_at) return;
    try {
      await markInboxItemRead(client, item.id);
      setItems((current) => current?.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry) ?? []);
    } catch { setError(true); }
  }

  if (items === null) return <AppState copy="Deine aktuellen Hinweise werden geladen." title={t('pending')} tone="loading" />;
  return <main className="operations-page notification-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">{t('notification.eyebrow')}</p><h1>{t('notification.title')}</h1><p>{t('notification.copy')}</p></div></header>
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
