import type { ReactNode } from 'react';

export type AppStateTone = 'loading' | 'error' | 'empty' | 'denied' | 'info';

const STATE_SYMBOLS: Record<Exclude<AppStateTone, 'loading'>, string> = {
  denied: '403',
  empty: '—',
  error: '!',
  info: 'i',
};

export function AppState({
  action,
  copy,
  title,
  tone = 'info',
}: {
  action?: ReactNode;
  copy?: ReactNode;
  title: ReactNode;
  tone?: AppStateTone;
}) {
  const loading = tone === 'loading';
  return <main aria-busy={loading || undefined} className={`app-state app-state--${tone}`} id="main-content">
    <div aria-hidden="true" className="app-state-visual">{loading ? <span className="app-state-loader"><i /><i /><i /></span> : STATE_SYMBOLS[tone]}</div>
    <div aria-live={loading ? 'polite' : tone === 'error' ? 'assertive' : undefined} className="app-state-content">
      <h1>{title}</h1>
      {copy && <p>{copy}</p>}
      {action && <div className="app-state-actions">{action}</div>}
    </div>
  </main>;
}

export function EmptyState({
  action,
  copy,
  title,
}: {
  action?: ReactNode;
  copy: ReactNode;
  title: ReactNode;
}) {
  return <div className="app-empty-state">
    <span aria-hidden="true">—</span>
    <div><h3>{title}</h3><p>{copy}</p>{action && <div className="app-empty-state-action">{action}</div>}</div>
  </div>;
}
