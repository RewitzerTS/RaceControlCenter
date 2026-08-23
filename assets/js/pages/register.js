(() => {
  'use strict';

  if (document.body?.dataset?.page !== 'register') return;

  const PENDING_KEY = 'rcc.pendingLeagueRegistration.v1';
  const META_NAME = 'rcc_pending_league_name';
  const META_SLUG = 'rcc_pending_league_slug';
  const META_PUBLIC = 'rcc_pending_league_public';
  const RESERVED_SLUGS = new Set([
    'admin', 'api', 'app', 'auth', 'login', 'logout', 'signup', 'register',
    'support', 'help', 'www', 'racecontrolcenter', 'racevora'
  ]);

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
  let continuationPromise = null;
  let availabilityPromise = null;

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
      position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
      width: '36px', height: '36px', border: '0', borderRadius: '9px',
      background: 'transparent', color: '#9eafc2', fontSize: '18px', lineHeight: '1', cursor: 'pointer'
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
    const target = new URL('account-setup.html', window.location.href);
    target.searchParams.set('registration', '1');
    return target.toString();
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
      : 'Liga-Leitung-Account erstellen';
  }

  function normalizePending(value) {
    if (!value) return null;
    const leagueName = String(value.leagueName || '').trim();
    const leagueSlug = slugify(value.leagueSlug || '');
    const email = String(value.email || '').trim().toLowerCase();
    if (leagueName.length < 3 || leagueSlug.length < 3 || !email) return null;
    return { leagueName, leagueSlug, isPublic: Boolean(value.isPublic), email };
  }

  function readPending() {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      return raw ? normalizePending(JSON.parse(raw)) : null;
    } catch (_) {
      return null;
    }
  }

  function pendingFromUser(user) {
    const metadata = user?.user_metadata || {};
    return normalizePending({
      leagueName: metadata[META_NAME],
      leagueSlug: metadata[META_SLUG],
      isPublic: metadata[META_PUBLIC] === true || metadata[META_PUBLIC] === 'true',
      email: user?.email
    });
  }

  function pendingForSession(session) {
    const local = readPending();
    const metadata = pendingFromUser(session?.user);
    if (!local) return metadata;
    if (!metadata) return local;
    const sessionEmail = String(session?.user?.email || '').trim().toLowerCase();
    return local.email === sessionEmail ? local : metadata;
  }

  function savePending(payload) {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ...payload, createdAt: new Date().toISOString() }));
  }

  function clearPending() {
    localStorage.removeItem(PENDING_KEY);
  }

  async function clearPendingMetadata() {
    try {
      await window.supabaseClient.auth.updateUser({
        data: { [META_NAME]: null, [META_SLUG]: null, [META_PUBLIC]: null }
      });
    } catch (error) {
      console.warn('Registration metadata cleanup failed:', error);
    }
  }

  function validatePayload() {
    const leagueName = String(nameInput?.value || '').trim();
    const leagueSlug = slugify(slugInput?.value || '');
    const email = String(emailInput?.value || '').trim().toLowerCase();
    const password = String(passwordInput?.value || '');
    const passwordConfirm = String(passwordConfirmInput?.value || '');

    if (leagueName.length < 3) throw new Error('Bitte einen Liganamen mit mindestens 3 Zeichen eingeben.');
    if (leagueName.length > 80) throw new Error('Der Liganame darf maximal 80 Zeichen lang sein.');
    if (/[<>]/.test(leagueName)) throw new Error('Der Liganame enthält ungültige Zeichen.');
    if (leagueSlug.length < 3) throw new Error('Bitte einen gültigen Kurznamen mit mindestens 3 Zeichen eingeben.');
    if (!emailInput?.checkValidity()) throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.');
    if (password.length < 10) throw new Error('Das Passwort muss mindestens 10 Zeichen lang sein.');
    if (password !== passwordConfirm) throw new Error('Die Passwörter stimmen nicht überein.');
    if (!consentInput?.checked) throw new Error('Bitte akzeptiere die AGB und die Datenschutzerklärung.');

    return { leagueName, leagueSlug, isPublic: visibilityInput?.value === 'public', email };
  }

  function draftLeaguePayload() {
    const leagueName = String(nameInput?.value || '').trim();
    const leagueSlug = slugify(slugInput?.value || '');
    if (leagueName.length < 3 || leagueSlug.length < 3) return null;
    return {
      leagueName,
      leagueSlug,
      isPublic: visibilityInput?.value === 'public',
      email: String(emailInput?.value || '').trim().toLowerCase()
    };
  }

  function friendlyAvailabilityError(availability) {
    if (!availability?.name_available) {
      nameInput?.setAttribute('aria-invalid', 'true');
      return 'Dieser Liganame wird bereits verwendet. Bitte wähle einen anderen Namen.';
    }
    if (availability?.slug_reserved) {
      slugInput?.setAttribute('aria-invalid', 'true');
      return 'Diese Liga-URL ist für RaceVora reserviert. Bitte wähle einen anderen Kurznamen.';
    }
    if (!availability?.slug_available) {
      slugInput?.setAttribute('aria-invalid', 'true');
      return 'Diese Liga-URL ist bereits vergeben. Bitte wähle einen anderen Kurznamen.';
    }
    return '';
  }

  function friendlyError(error) {
    const message = String(error?.message || error || '');
    if (/League name already exists/i.test(message)) {
      return 'Dieser Liganame wird bereits verwendet. Bitte wähle einen anderen Namen.';
    }
    if (/League slug already exists/i.test(message)) {
      return 'Diese Liga-URL ist bereits vergeben. Bitte wähle einen anderen Kurznamen.';
    }
    if (/This league slug is reserved/i.test(message)) {
      return 'Diese Liga-URL ist für RaceVora reserviert. Bitte wähle einen anderen Kurznamen.';
    }
    return message || 'Die Registrierung konnte nicht abgeschlossen werden.';
  }

  async function sha256Key(value) {
    if (!window.crypto?.subtle || typeof TextEncoder === 'undefined') {
      throw new Error('Die sichere Liga-Prüfung wird von diesem Browser nicht unterstützt.');
    }
    const bytes = new TextEncoder().encode(String(value || ''));
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function checkLeagueAvailability(payload, { announceSuccess = false } = {}) {
    if (!payload || !window.supabaseClient) throw new Error('Die Liga-Verfügbarkeit konnte nicht geprüft werden.');
    if (availabilityPromise) return availabilityPromise;

    nameInput?.removeAttribute('aria-invalid');
    slugInput?.removeAttribute('aria-invalid');

    availabilityPromise = (async () => {
      const normalizedName = String(payload.leagueName || '').trim().toLowerCase();
      const normalizedSlug = slugify(payload.leagueSlug || '');
      const slugReserved = RESERVED_SLUGS.has(normalizedSlug);
      const [nameKey, slugKey] = await Promise.all([
        sha256Key(normalizedName),
        sha256Key(normalizedSlug)
      ]);

      const { data, error } = await window.supabaseClient
        .from('league_registration_keys')
        .select('name_key, slug_key')
        .or(`name_key.eq.${nameKey},slug_key.eq.${slugKey}`);

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      const availability = {
        name_available: !rows.some((row) => row?.name_key === nameKey),
        slug_available: !slugReserved && !rows.some((row) => row?.slug_key === slugKey),
        slug_reserved: slugReserved
      };

      const conflictMessage = friendlyAvailabilityError(availability);
      if (conflictMessage) throw new Error(conflictMessage);

      if (announceSuccess) setFeedback('Liganame und Liga-URL sind verfügbar.', 'success');
      return availability;
    })().finally(() => {
      availabilityPromise = null;
    });

    return availabilityPromise;
  }

  async function functionErrorMessage(error) {
    try {
      const response = error?.context;
      if (response && typeof response.clone === 'function') {
        const payload = await response.clone().json();
        if (payload?.message) return String(payload.message);
      }
    } catch (_) {
      // Fall back to the SDK error message below.
    }
    return String(error?.message || 'Die Registrierung konnte serverseitig nicht abgeschlossen werden.');
  }

  async function createLeagueForSession(session, pending) {
    if (!session?.user?.id) throw new Error('Bitte bestätige zuerst deine E-Mail und melde dich an.');
    if (!pending) throw new Error('Die begonnenen Liga-Daten konnten nicht wiederhergestellt werden. Bitte starte die Registrierung erneut.');

    const sessionEmail = String(session.user.email || '').trim().toLowerCase();
    if (pending.email && sessionEmail !== String(pending.email).toLowerCase()) {
      throw new Error('Der angemeldete Account passt nicht zur begonnenen Registrierung.');
    }

    setBusy(true, 'Registrierung wird abgeschlossen …');
    setFeedback('Account bestätigt. Rennliga und Vertragsbestätigung werden jetzt sicher eingerichtet …');

    const { data, error } = await window.supabaseClient.functions.invoke('finalize-consumer-registration', {
      body: {
        leagueName: pending.leagueName,
        leagueSlug: pending.leagueSlug,
        isPublic: Boolean(pending.isPublic)
      }
    });

    if (error) throw new Error(await functionErrorMessage(error));
    if (!data?.ok) throw new Error(data?.message || 'Die Registrierung konnte nicht abgeschlossen werden.');

    const league = data.league;
    if (!league?.slug || !['admin', 'owner'].includes(league.role)) {
      throw new Error('Die Liga-Leitung konnte nicht korrekt angelegt werden.');
    }
    if (!data?.confirmation?.sent_at) {
      throw new Error('Die Vertragsbestätigung wurde noch nicht versendet. Bitte versuche es erneut.');
    }

    clearPending();
    await clearPendingMetadata();
    try {
      sessionStorage.setItem('rcc.activeLeagueSlug.v1', league.slug);
      sessionStorage.setItem('rcc.lastTenantSlug.v1', league.slug);
      sessionStorage.setItem('racevora.contractConfirmationReference.v1', String(data.confirmation.reference || ''));
    } catch (_) {
      // Session storage is optional.
    }

    setFeedback('Vertragsbestätigung gesendet. Deine Rennliga ist angelegt – der Einrichtungsassistent wird geöffnet …', 'success');
    const target = new URL('admin.html', window.location.href);
    target.searchParams.set('league', league.slug);
    target.searchParams.set('onboarding', '1');
    window.location.assign(target.toString());
    return league;
  }

  function continueRegistration(session) {
    if (!session?.user) return Promise.resolve(null);
    if (continuationPromise) return continuationPromise;

    const pending = pendingForSession(session);
    if (!pending) return Promise.resolve(null);

    continuationPromise = createLeagueForSession(session, pending)
      .catch((error) => {
        console.error('Registration continuation failed:', error);
        setFeedback(friendlyError(error), 'error');
        setBusy(false);
        throw error;
      })
      .finally(() => {
        continuationPromise = null;
      });

    return continuationPromise;
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

  async function resumePendingRegistration() {
    if (busy || !window.supabaseClient?.auth) return;
    try {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data?.session?.user) {
        setFeedback('Bitte bestätige zuerst deine E-Mail-Adresse. Danach kannst du die Registrierung hier fortsetzen.', 'info');
        return;
      }
      await continueRegistration(data.session);
    } catch (error) {
      setFeedback(friendlyError(error), 'error');
    }
  }

  function renderPendingState(pending) {
    if (!resume || !pending) return;
    resume.hidden = false;
    resume.replaceChildren();

    const text = document.createElement('span');
    text.textContent = `Registrierung für „${pending.leagueName}“ mit ${pending.email} ist noch nicht vollständig abgeschlossen.`;

    const resend = document.createElement('button');
    resend.type = 'button';
    resend.textContent = 'Bestätigungs-E-Mail erneut senden';
    resend.addEventListener('click', () => resendConfirmation(pending, resend));

    const resumeButton = document.createElement('button');
    resumeButton.type = 'button';
    resumeButton.textContent = 'Registrierung fortsetzen';
    resumeButton.addEventListener('click', resumePendingRegistration);

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Registrierung verwerfen';
    clear.addEventListener('click', () => {
      clearPending();
      resume.hidden = true;
      setFeedback('Die lokale Registrierung wurde verworfen. Ein bereits angelegter Account bleibt bestehen.');
    });

    resume.append(text, resend, resumeButton, clear);
  }

  async function submitRegistration(event) {
    event.preventDefault();
    if (busy || !window.supabaseClient?.auth) return;

    try {
      const payload = validatePayload();
      setBusy(true, 'Liga wird geprüft …');
      setFeedback('Liganame und Liga-URL werden auf Verfügbarkeit geprüft …');
      await checkLeagueAvailability(payload);

      savePending(payload);
      renderPendingState(payload);
      setBusy(true, 'Account wird erstellt …');
      setFeedback('Account wird erstellt …');

      const { data, error } = await window.supabaseClient.auth.signUp({
        email: payload.email,
        password: String(passwordInput?.value || ''),
        options: {
          emailRedirectTo: confirmationRedirectUrl(),
          data: {
            [META_NAME]: payload.leagueName,
            [META_SLUG]: payload.leagueSlug,
            [META_PUBLIC]: Boolean(payload.isPublic)
          }
        }
      });
      if (error) throw error;

      passwordInput.value = '';
      passwordConfirmInput.value = '';

      if (data?.session) {
        await continueRegistration(data.session);
        return;
      }

      setFeedback('Fast geschafft: Bitte bestätige jetzt deine E-Mail-Adresse. Danach richtet RaceVora deine Rennliga ein und sendet dir die Vertragsbestätigung per E-Mail.', 'success');
    } catch (error) {
      console.error('Liga-Leitung registration failed:', error);
      setFeedback(friendlyError(error), 'error');
    } finally {
      if (!location.href.includes('admin.html') && !continuationPromise) setBusy(false);
    }
  }

  async function resumeAfterConfirmation() {
    const localPending = readPending();
    if (localPending) renderPendingState(localPending);
    if (!window.supabaseClient?.auth) return;

    try {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) throw error;
      const session = data?.session;
      if (!session?.user) return;

      const pending = pendingForSession(session);
      if (!pending) {
        setFeedback('Du bist bereits angemeldet. Für eine neue Liga starte bitte eine neue Registrierung oder öffne deine bestehende Liga.', 'info');
        return;
      }

      renderPendingState(pending);
      await continueRegistration(session);
    } catch (error) {
      if (!String(error?.message || '').includes('Liga-Einrichtung')) {
        console.error('Registration resume failed:', error);
        setFeedback(friendlyError(error), 'error');
      }
      setBusy(false);
    }
  }

  async function checkDraftAvailability() {
    if (busy) return;
    const payload = draftLeaguePayload();
    if (!payload) return;

    try {
      setFeedback('Verfügbarkeit wird geprüft …');
      await checkLeagueAvailability(payload, { announceSuccess: true });
    } catch (error) {
      setFeedback(friendlyError(error), 'error');
    }
  }

  function bind() {
    installPasswordToggle(passwordInput);
    installPasswordToggle(passwordConfirmInput);

    nameInput?.addEventListener('input', () => {
      nameInput.removeAttribute('aria-invalid');
      if (!slugWasEdited && slugInput) slugInput.value = slugify(nameInput.value);
    });
    slugInput?.addEventListener('input', () => {
      slugWasEdited = true;
      slugInput.removeAttribute('aria-invalid');
      slugInput.value = slugify(slugInput.value);
    });
    nameInput?.addEventListener('blur', checkDraftAvailability);
    slugInput?.addEventListener('blur', checkDraftAvailability);
    form?.addEventListener('submit', submitRegistration);

    window.supabaseClient?.auth?.onAuthStateChange?.((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && !continuationPromise) {
        const pending = pendingForSession(session);
        if (!pending) return;
        renderPendingState(pending);
        continueRegistration(session).catch(() => {});
      }
    });
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('confirmed') === '1') {
      const target = new URL('account-setup.html', window.location.href);
      target.search = window.location.search;
      target.hash = window.location.hash;
      window.location.replace(target.toString());
      return;
    }

    bind();
    await resumeAfterConfirmation();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
