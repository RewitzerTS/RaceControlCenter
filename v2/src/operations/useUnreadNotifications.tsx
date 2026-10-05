import { useEffect, useState } from 'react';
import type { LeagueSupabaseClient } from '../lib/supabase';
import './notificationBadge.css';

export const INBOX_CHANGED = 'racevora:inbox-changed';

export function useUnreadNotifications(client: LeagueSupabaseClient, userId: string | null) {
  const [result, setResult] = useState<{ userId: string; count: number } | null>(null);
  useEffect(() => {
    if (!userId) { setResult(null); return; }
    let active = true;
    let sequence = 0;
    const controller = new AbortController();
    const refresh = async () => {
      const request = ++sequence;
      const response = await client.from('user_notifications').select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', userId).is('read_at', null).abortSignal(controller.signal);
      if (active && request === sequence && !response.error && response.count !== null) setResult({ userId, count: response.count });
    };
    const reload = () => { if (document.visibilityState !== 'hidden') void refresh().catch(() => undefined); };
    reload();
    const timer = window.setInterval(reload, 30_000);
    window.addEventListener(INBOX_CHANGED, reload);
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', reload);
    return () => {
      active = false; controller.abort(); window.clearInterval(timer);
      window.removeEventListener(INBOX_CHANGED, reload);
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', reload);
    };
  }, [client, userId]);
  return result?.userId === userId ? result?.count ?? 0 : 0;
}

export function NotificationBadge({ count }: { count: number }) {
  return count > 0 ? <b className="notification-count" aria-hidden="true">{count > 99 ? '99+' : count}</b> : null;
}
