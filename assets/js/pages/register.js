(() => {
  'use strict';

  if (document.body?.dataset?.page !== 'register') return;

  const PENDING_KEY = 'rcc.pendingLeagueRegistration.v1';
  const form = document.getElementById('league-registration-form');
  const nameInput = document.getElementById('register-league-name');
  const slugInput = document.getElementById('register-league-slug');
  const visibilityInput = document.getElementById('register-league-visibility');
  const emailInput = document.getElementById('register-email');
  const passwordInput = document.getElementById('register-password');
  const passwordConfirmInput = document.getElementById('register-password-confirm');
  const consentInput = document.getElementById('register-consent');
  const submitButton = document.getElementById('register-submit');
  const feedback = document.getElementById('register-feedback');
  const resume = document.getElementById('register-resume');
  let busy = false;
  let slugWasEdited = false;

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  function installPasswordToggle(input) {
    if (!input || input.dataset.passwordToggleReady === '1') return;
    input.dataset.passwordToggleReady = '1';

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'block';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.style.paddingRight = '52px';

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Passwort anzeigen');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Passwort anzeigen';
    button.textContent = '◉';
    Object.assign(button.style, {
      position: 'absolute',
      right: '8px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '36px',
      height: '36px',
      border: '0',
      borderRadius: '9px',
      background: 'transparent',
      color: '#9eafc2',
      fontSize: '18px',
      lineHeight: '1',
      cursor: 'pointer'
    });

    button.addEventListener('click', () => {
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.setAttribute('aria-pressed', String(!visible));
      button.setAttribute('aria-label', visible ? 'Passwort anzeigen' : 'Passwort verbergen');
      button.title = visible ? 'Passwort anzeigen' : 'Passwort verbergen';
      button.textContent = visible ? '◉' : '◌';
      input.focus({ preventScroll: true });
      const length = input.value.length;
      input.setSelectionRange?.(length, length);
    });

    wrapper.appendChild(button);
  }

  function confirmationRedirectUrl() {
    return new URL('register.html?confirmed=1', window.location.href).toString();
  }

  function setFeedback(message = '', level = 'info') {
    if (!feedback) return;
    feedback.hidden = !message;
    feedback.textContent = message;
    feedback.dataset.level = level;
  }

  function setBusy(value, label = '') {
    busy = value;
    if (!submitButton) return;
    submitButton.disabled = value;
    submitButton.innerHTML = value
      ? `${label || 'Wird verarbeitet …'}`
      : 'Liga-Leitung-Account erstellen <span aria-hidden="true">→</span>';
  }

  function readPending() {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.email || !parsed?.leagueName || !parsed?.leagueSlug) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function savePending(payload) {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ...payload, createdAt: new Date().toISOString() }));
  }

  function clearPending() {
    localStorage.removeItem(PENDING_KEY);
  }

  function validatePayload() {
    const leagueName = String(nameInput?.value || '').trim();
    const leagueSlug = slugify(slugInput?.value || '');
    const email = String(emailInput?.value || '').trim().toLowerCase();
    const password = String(passwordInput?.value || '');
    const passwordConfirm = String(passwordConfirmInput?.value || '');

    if (leagueName.length < 3) throw new Error('Bitte einen Liganamen mit mindestens 3 Zeichen eingeben.');
    if (leagueSlug.length < 3) throw new Error('Bitte einen gültigen Kurzname mit mindestens 3 Zeichen eingeben.');
    if (!emailInput?.checkValidity()) throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.');
    if (password.length < 10) throw new Error('Das Passwort muss mindestens 10 Zeichen lang sein.');
    if (password !== passwordConfirm) throw new Error('Die Passwörter stimmen nicht überein.');
    if (!consentInput?.checked) throw new Error('Bitte bestätige die Account-Erstellung.');

    return {
      leagueName,
      leagueSlug,
      isPublic: visibilityInput?.value === 'public',
      email
    };
  }

  async function createLeagueForSession(session, pending) {
    if (!session?.user?.id) throw new Error('Bitte bestätige zuerst deine E-Mail und melde dich an.');
    const sessionEmail = String(session.user.email || '').trim().toLowerCase();
    if (pending.email && sessionEmail !== String(pending.email).toLowerCase()) {
      throw new Error('Der angemeldete Account passt nicht zur begonnenen Registrierung.');
    }

    setBusy(true, 'Rennliga wird angelegt …');
    setFeedback('Account bestätigt. Deine Rennliga wird jetzt angelegt …');

    const { data, error } = await window.supabaseClient.rpc('create_league', {
      p_name: pending.leagueName,
      p_slug: pending.leagueSlug,
      p_is_public: Boolean(pending.isPublic)
    });
    if (error) throw error;

    const league = Array.isArray(data) ? data[0] : data;
    if (!league?.slug || league.role !== 'admin') {
      throw new Error('Die Liga-Leitung konnte nicht korrekt angelegt werden.');
    }

    clearPending();
    setFeedback('Deine Rennliga ist angelegt. Der Einrichtungsassistent wird geöffnet …', 'success');
    const target = new URL('admin.html', window.location.href);
    target.searchParams.set('league', league.slug);
    target.searchParams.set('onboarding', '1');
    window.location.assign(target.toString());
  }

  async function resendConfirmation(pending, button) {
    if (busy || !window.supabaseClient?.auth || !pending?.email) return;
    const originalLabel = button?.textContent || 'Bestätigungs-E-Mail erneut senden';
    try {
      busy = true;
      if (button) {
        button.disabled = true;
        button.textContent = 'E-Mail wird gesendet …';
      }
      setFeedback('Bestätigungs-E-Mail wird erneut gesendet …');
      const { error } = await window.supabaseClient.auth.resend({
        type: 'signup',
        email: pending.email,
        options: { emailRedirectTo: confirmationRedirectUrl() }
      });
      if (error) throw error;
      setFeedback(`Eine neue Bestätigungs-E-Mail wurde an ${pending.email} gesendet.`, 'success');
    } catch (error) {
      console.error('Signup confirmation resend failed:', error);
      setFeedback(error?.message || 'Die Bestätigungs-E-Mail konnte nicht erneut gesendet werden.', 'error');
    } finally {
      busy = false;
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }
  }

  function renderPendingState(pending) {
    if (!resume || !pending) return;
    resume.hidden = false;
    resume.replaceChildren();

    const text = document.createElement('span');
    text.textContent = `Registrierung für „${pending.leagueName}“ mit ${pending.email} wartet auf E-Mail-Bestätigung.`;

    const resend = document.createElement('button');
    resend.type = 'button';
    resend.textContent = 'Bestätigungs-E-Mail erneut senden';
    resend.addEventListener('click', () => resendConfirmation(pending, resend));

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Registrierung verwerfen';
    clear.addEventListener('click', () => {
      clearPending();
      resume.hidden = true;
      setFeedback('Die begonnene Registrierung wurde lokal verworfen. Ein bereits angelegter, noch unbestätigter Account bleibt bestehen und kann über „Bestätigungs-E-Mail erneut senden“ fortgesetzt werden.');
    });
    resume.append(text, resend, clear);
  }

  async function submitRegistration(event) {
    event.preventDefault();
    if (busy || !window.supabaseClient?.auth) return;

    try {
      const payload = validatePayload();
      savePending(payload);
      renderPendingState(payload);
      setBusy(true, 'Account wird erstellt …');
      setFeedback('Account wird erstellt …');

      const { data, error } = await window.supabaseClient.auth.signUp({
        email: payload.email,
        password: String(passwordInput?.value || ''),
        options: { emailRedirectTo: confirmationRedirectUrl() }
      });
      if (error) throw error;

      passwordInput.value = '';
      passwordConfirmInput.value = '';

      if (data?.session) {
        await createLeagueForSession(data.session, payload);
        return;
      }

      setFeedback('Fast geschafft: Bitte bestätige jetzt deine E-Mail-Adresse. Falls keine Mail ankommt, kannst du sie oben erneut senden.', 'success');
    } catch (error) {
      console.error('Liga-Leitung registration failed:', error);
      setFeedback(error?.message || 'Die Registrierung konnte nicht abgeschlossen werden.', 'error');
    } finally {
      if (!location.href.includes('admin.html')) setBusy(false);
    }
  }

  async function resumeAfterConfirmation() {
    const pending = readPending();
    if (pending) renderPendingState(pending);
    if (!window.supabaseClient?.auth) return;

    try {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) throw error;
      const session = data?.session;
      if (!session?.user) return;

      if (!pending) {
        setFeedback('Du bist bereits angemeldet. Für eine neue Liga starte bitte eine neue Registrierung oder öffne deine bestehende Liga.', 'info');
        return;
      }

      await createLeagueForSession(session, pending);
    } catch (error) {
      console.error('Registration resume failed:', error);
      setFeedback(error?.message || 'Die Registrierung konnte nach der Anmeldung nicht fortgesetzt werden.', 'error');
      setBusy(false);
    }
  }

  function bind() {
    installPasswordToggle(passwordInput);
    installPasswordToggle(passwordConfirmInput);

    nameInput?.addEventListener('input', () => {
      if (!slugWasEdited && slugInput) slugInput.value = slugify(nameInput.value);
    });
    slugInput?.addEventListener('input', () => {
      slugWasEdited = true;
      slugInput.value = slugify(slugInput.value);
    });
    form?.addEventListener('submit', submitRegistration);

    window.supabaseClient?.auth?.onAuthStateChange?.((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && readPending() && !busy) {
        createLeagueForSession(session, readPending()).catch((error) => {
          console.error('Registration auth continuation failed:', error);
          setFeedback(error?.message || 'Die Liga-Einrichtung konnte nicht fortgesetzt werden.', 'error');
          setBusy(false);
        });
      }
    });
  }

  async function init() {
    bind();
    await resumeAfterConfirmation();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
