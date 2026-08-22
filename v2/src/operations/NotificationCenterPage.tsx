import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { loadInbox, markInboxItemRead, type InboxNotification } from './operations';

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

  if (items === null) return <main className="driver-state" id="main-content"><span className="state-mark">19</span><div><h1>{t('pending')}</h1></div></main>;
  return <main className="operations-page notification-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">{t('notification.eyebrow')}</p><h1>{t('notification.title')}</h1><p>{t('notification.copy')}</p></div></header>
    {error && <p className="inline-error" role="alert">{t('notification.error')}</p>}
    {!user ? <p className="empty-copy">{t('notification.signedOut')}</p> : items.length === 0 ? <p className="empty-copy">{t('notification.empty')}</p> : <ol className="notification-list">{items.map((item) => <li className={item.read_at ? '' : 'notification-unread'} key={item.id}><button type="button" onClick={() => void markRead(item)}><span className="notification-dot" aria-hidden="true" /><span><strong>{t(item.title_key as never)}</strong><small>{t(item.body_key as never)}</small></span><time dateTime={item.created_at}>{formatDate(item.created_at)} · {formatTime(item.created_at)}</time></button></li>)}</ol>}
  </main>;
}
