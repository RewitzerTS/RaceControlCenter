// Local UI harness; no real emails. Not included in the production build.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../src/i18n/I18nProvider';
import { BetaFeedback } from '../src/feedback/BetaFeedback';
import '../src/styles.css';
const originalFetch = window.fetch;
window.fetch = (input, init) => input === '/api/beta-feedback'
  ? Promise.resolve(new Response(JSON.stringify(init?.method === 'POST' ? { ok: true } : { ready: true }), { headers: { 'Content-Type': 'application/json' } }))
  : originalFetch(input, init);
createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider><MemoryRouter initialEntries={['/home']}><main className="container" style={{ minHeight: '140vh', paddingTop: 32 }}><h1>RaceVora</h1><p>Lokale Formularprüfung – keine E-Mails werden gesendet.</p></main><nav className="mobile-primary-navigation" aria-label="Navigation"><a className="mobile-primary-item" href="#home">Home</a><a className="mobile-primary-item" href="#racing">Racing</a><a className="mobile-primary-item" href="#career">Career</a><a className="mobile-primary-item" href="#more">Mehr</a></nav><BetaFeedback /></MemoryRouter></I18nProvider></React.StrictMode>);
