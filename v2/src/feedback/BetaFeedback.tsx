import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';
import './feedback.css';

type FormConfig = { ready: boolean };

export function feedbackPage(pathname: string) {
  // Send only the route: never query strings, tokens, hashes, or page contents.
  return pathname.split(/[?#]/, 1)[0].slice(0, 200);
}

export function BetaFeedback({ obscured = false }: { obscured?: boolean }) {
  const { t } = useI18n();
  const location = useLocation();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [kind, setKind] = useState('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [page, setPage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<MessageKey | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setConfig(null);
    void fetch('/api/beta-feedback', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unavailable');
        const value: unknown = await response.json();
        if (!value || typeof value !== 'object' || !('ready' in value)) throw new Error('unavailable');
        setConfig({ ready: value.ready === true });
      })
      .catch(() => { if (!controller.signal.aborted) setConfig({ ready: false }); });
    return () => controller.abort();
  }, [open]);

  function show() {
    setPage(feedbackPage(location.pathname));
    if (status === 'feedback.success') setStatus(null);
    setOpen(true);
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !config?.ready || message.trim().length < 5) return;
    inFlight.current = true;
    setSending(true);
    setStatus(null);
    try {
      const response = await fetch('/api/beta-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ kind, message: message.trim(), email: email.trim(), page, website }),
        signal: AbortSignal.timeout(25000),
      });
      if (response.ok) {
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== true) throw new Error('not accepted');
        setStatus('feedback.success');
        setMessage(''); setEmail('');
      } else {
        setStatus(response.status === 429 ? 'feedback.rateLimit' : response.status === 503 ? 'feedback.unavailable' : 'feedback.error');
      }
    } catch { setStatus('feedback.error'); }
    finally { inFlight.current = false; setSending(false); }
  }

  return <>
    <button ref={trigger} className="feedback-trigger" hidden={obscured} aria-label={t('feedback.open')} title={t('feedback.open')} aria-haspopup="dialog" aria-controls="beta-feedback-dialog" onClick={show} type="button">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-5 3V8.5A5.5 5.5 0 0 1 8.5 3h4A7.5 7.5 0 0 1 20 10.5Z" /><path d="M7 9h8M7 13h5" /></svg>
    </button>
    <dialog id="beta-feedback-dialog" ref={dialog} className="feedback-dialog" aria-labelledby="beta-feedback-title" aria-describedby="beta-feedback-intro" onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      <header className="feedback-heading">
        <h2 id="beta-feedback-title">{t('feedback.title')}</h2>
        <button className="feedback-close" type="button" onClick={close} aria-label={t('feedback.close')}><span aria-hidden="true">×</span></button>
      </header>
      <p id="beta-feedback-intro">{t('feedback.intro')}</p>
      {status === 'feedback.success' ? <div className="feedback-result"><p role="status">{t(status)}</p><button className="secondary-action" onClick={close} type="button">{t('feedback.close')}</button></div> : <form onSubmit={submit}>
        <label htmlFor="feedback-kind">{t('feedback.kind')}</label>
        <select id="feedback-kind" value={kind} disabled={sending} onChange={(event) => setKind(event.target.value)}>{(['bug', 'idea', 'other'] as const).map((value) => <option value={value} key={value}>{t(`feedback.${value}`)}</option>)}</select>
        <label htmlFor="feedback-message">{t('feedback.message')}</label>
        <textarea id="feedback-message" required minLength={5} maxLength={4000} rows={4} value={message} disabled={sending} placeholder={t('feedback.placeholder')} onChange={(event) => setMessage(event.target.value)} />
        <label htmlFor="feedback-email">{t('feedback.email')}</label>
        <input id="feedback-email" type="email" autoComplete="email" maxLength={254} value={email} disabled={sending} onChange={(event) => setEmail(event.target.value)} />
        <div className="feedback-honeypot" aria-hidden="true"><label htmlFor="feedback-website">Website</label><input id="feedback-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>
        <p className="feedback-privacy">{t('feedback.privacy')} <a href="/datenschutz.html" target="_blank" rel="noreferrer">{t('feedback.policy')}</a></p>
        <p className="feedback-page">{t('feedback.page')}: <span>{page}</span></p>
        {!config && <p role="status">{t('feedback.loading')}</p>}
        {config && !config.ready && <p role="status">{t('feedback.unavailable')}</p>}
        {status && <p className="feedback-error" role="alert">{t(status)}</p>}
        <button className="primary-action feedback-submit" type="submit" disabled={sending || !config?.ready || message.trim().length < 5}>{t(sending ? 'feedback.sending' : 'feedback.send')}</button>
      </form>}
    </dialog>
  </>;
}
