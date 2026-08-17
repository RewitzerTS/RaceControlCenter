(() => {
  'use strict';

  const siteKey = String(window.RACEVORA_TURNSTILE_SITE_KEY || '').trim();
  const client = window.supabaseClient;
  if (!siteKey || !client?.auth || client.auth.__raceVoraTurnstilePatched) return;

  const SCRIPT_ID = 'racevora-turnstile-api';
  const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  const FORM_SELECTORS = [
    '#league-registration-form',
    '#landing-login-form',
    '#password-recovery-form'
  ];

  let widgetId = null;
  let widgetContainer = null;
  let token = '';
  let tokenPromise = null;
  let resolveToken = null;
  let rejectToken = null;
  let scriptPromise = null;

  function statusNode(container) {
    let node = container.querySelector('.racevora-turnstile-status');
    if (!node) {
      node = document.createElement('small');
      node.className = 'racevora-turnstile-status';
      node.setAttribute('aria-live', 'polite');
      node.style.display = 'block';
      node.style.marginTop = '8px';
      node.style.color = '#9eafc2';
      container.appendChild(node);
    }
    return node;
  }

  function setStatus(message = '', isError = false) {
    if (!widgetContainer) return;
    const node = statusNode(widgetContainer);
    node.textContent = message;
    node.style.color = isError ? '#ff8f8f' : '#9eafc2';
  }

  function findOrCreateContainer() {
    if (widgetContainer?.isConnected) return widgetContainer;
    const form = FORM_SELECTORS.map((selector) => document.querySelector(selector)).find(Boolean);
    if (!form) return null;

    let container = form.querySelector('[data-racevora-turnstile]');
    if (!container) {
      container = document.createElement('div');
      container.dataset.racevoraTurnstile = '1';
      container.style.margin = '12px 0';
      const submit = form.querySelector('button[type="submit"]');
      if (submit) form.insertBefore(container, submit);
      else form.appendChild(container);
    }

    widgetContainer = container;
    return container;
  }

  function loadScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
        existing.addEventListener('error', () => reject(new Error('Turnstile konnte nicht geladen werden.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error('Turnstile konnte nicht geladen werden.'));
      document.head.appendChild(script);
    });

    return scriptPromise;
  }

  function settleToken(value) {
    token = String(value || '');
    if (token && resolveToken) resolveToken(token);
    resolveToken = null;
    rejectToken = null;
    tokenPromise = null;
    setStatus(token ? 'Sicherheitsprüfung abgeschlossen.' : '');
  }

  function failToken(message) {
    const error = new Error(message || 'Sicherheitsprüfung fehlgeschlagen.');
    rejectToken?.(error);
    resolveToken = null;
    rejectToken = null;
    tokenPromise = null;
    token = '';
    setStatus('Sicherheitsprüfung fehlgeschlagen. Bitte versuche es erneut.', true);
  }

  async function ensureWidget() {
    if (widgetId !== null && widgetContainer?.isConnected) return widgetId;
    const container = findOrCreateContainer();
    if (!container) throw new Error('Sicherheitsprüfung konnte nicht eingeblendet werden.');

    setStatus('Sicherheitsprüfung wird vorbereitet …');
    const turnstile = await loadScript();
    if (!turnstile?.render) throw new Error('Sicherheitsprüfung konnte nicht initialisiert werden.');

    widgetId = turnstile.render(container, {
      sitekey: siteKey,
      theme: 'auto',
      size: 'flexible',
      appearance: 'interaction-only',
      callback: settleToken,
      'expired-callback': () => {
        token = '';
        setStatus('Sicherheitsprüfung abgelaufen. Sie wird erneuert …');
      },
      'error-callback': () => failToken('Turnstile konnte die Sicherheitsprüfung nicht abschließen.')
    });

    return widgetId;
  }

  async function getToken() {
    if (token) return token;
    await ensureWidget();
    if (token) return token;
    if (tokenPromise) return tokenPromise;

    tokenPromise = new Promise((resolve, reject) => {
      resolveToken = resolve;
      rejectToken = reject;
    });
    setStatus('Bitte Sicherheitsprüfung abschließen …');
    return tokenPromise;
  }

  function resetWidget() {
    token = '';
    resolveToken = null;
    rejectToken = null;
    tokenPromise = null;
    if (widgetId !== null && window.turnstile?.reset) {
      try {
        window.turnstile.reset(widgetId);
        setStatus('');
      } catch (_) {
        widgetId = null;
      }
    }
  }

  async function withCaptcha(run) {
    const captchaToken = await getToken();
    try {
      return await run(captchaToken);
    } finally {
      resetWidget();
    }
  }

  const nativeSignUp = client.auth.signUp.bind(client.auth);
  const nativeSignInWithPassword = client.auth.signInWithPassword.bind(client.auth);
  const nativeResetPasswordForEmail = client.auth.resetPasswordForEmail.bind(client.auth);
  const nativeResend = client.auth.resend.bind(client.auth);

  client.auth.signUp = (credentials = {}) => withCaptcha((captchaToken) => nativeSignUp({
    ...credentials,
    options: { ...(credentials.options || {}), captchaToken }
  }));

  client.auth.signInWithPassword = (credentials = {}) => withCaptcha((captchaToken) => nativeSignInWithPassword({
    ...credentials,
    options: { ...(credentials.options || {}), captchaToken }
  }));

  client.auth.resetPasswordForEmail = (email, options = {}) => withCaptcha((captchaToken) => nativeResetPasswordForEmail(email, {
    ...options,
    captchaToken
  }));

  client.auth.resend = (credentials = {}) => withCaptcha((captchaToken) => nativeResend({
    ...credentials,
    options: { ...(credentials.options || {}), captchaToken }
  }));

  client.auth.__raceVoraTurnstilePatched = true;

  function warmUpVisibleAuthForm() {
    const form = FORM_SELECTORS.map((selector) => document.querySelector(selector)).find(Boolean);
    if (!form) return;
    const modal = form.closest('[hidden]');
    if (modal) return;
    ensureWidget().catch((error) => {
      console.warn('RaceVora Turnstile warm-up failed:', error);
      setStatus('Sicherheitsprüfung konnte nicht geladen werden. Bitte Seite neu laden.', true);
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target?.closest?.('[data-login-open]')) return;
    window.setTimeout(warmUpVisibleAuthForm, 0);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', warmUpVisibleAuthForm, { once: true });
  } else {
    warmUpVisibleAuthForm();
  }

  window.RaceVoraAuthTurnstile = {
    enabled: true,
    getToken,
    reset: resetWidget
  };
})();
