import { useEffect, useState } from 'react';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { useI18n } from '../i18n/I18nProvider';
import './owner-users.css';

type Directory = { total: number; users: Array<{ id: string; name: string | null; email: string | null }> };

export function OwnerUsersCard({ client }: { client: LeagueSupabaseClient }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<Directory | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setData(null);
    setError(false);
    void (async () => {
      try {
        const result = await client.rpc('get_owner_registered_users', { p_offset: offset });
        if (result.error) throw result.error;
        const next = result.data as unknown as Directory;
        if (!next || !Array.isArray(next.users) || !Number.isFinite(next.total)) throw new Error('Invalid directory');
        if (active) setData(next);
      } catch { if (active) setError(true); }
    })();
    return () => { active = false; };
  }, [client, open, offset, retry]);

  return <details className="owner-users" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><h2>{t('ownerUsers.title')}</h2></summary>
    {open && <div className="owner-users-content">
      {error ? <div role="alert"><p>{t('ownerUsers.error')}</p><button type="button" onClick={() => setRetry(retry + 1)}>{t('ownerUsers.retry')}</button></div>
        : !data ? <p role="status">{t('ownerUsers.loading')}</p>
          : <>
            <p role="status">{t('ownerUsers.total', { count: data.total })}</p>
            {data.users.length === 0 ? <p>{t('ownerUsers.empty')}</p> : <table>
              <thead><tr><th scope="col">{t('ownerUsers.name')}</th><th scope="col">{t('ownerUsers.email')}</th></tr></thead>
              <tbody>{data.users.map((user) => <tr key={user.id}><td>{user.name || t('ownerUsers.noName')}</td><td>{user.email || '—'}</td></tr>)}</tbody>
            </table>}
            {(offset > 0 || data.total > 50) && <nav aria-label={t('ownerUsers.pages')}>
              <button type="button" disabled={offset === 0} onClick={() => { setData(null); setOffset(Math.max(0, offset - 50)); }}>{t('ownerUsers.previous')}</button>
              <span>{t('ownerUsers.page', { page: offset / 50 + 1 })}</span>
              <button type="button" disabled={offset + 50 >= data.total} onClick={() => { setData(null); setOffset(offset + 50); }}>{t('ownerUsers.next')}</button>
            </nav>}
          </>}
    </div>}
  </details>;
}
