(() => {
  const logoFixHref = 'assets/css/pages/landing-brand-fix.css';
  if (!document.querySelector(`link[href="${logoFixHref}"]`)) {
    const logoFix = document.createElement('link');
    logoFix.rel = 'stylesheet';
    logoFix.href = logoFixHref;
    document.head.appendChild(logoFix);
  }

  const modal = document.getElementById('landing-login-modal');
  const form = document.getElementById('landing-login-form');
  const emailInput = document.getElementById('landing-login-email');
  const passwordInput = document.getElementById('landing-login-password');
  const feedback = document.getElementById('landing-login-feedback');
  const leaguePicker = document.getElementById('landing-league-picker');
  const intro = document.getElementById('landing-login-intro');
  const year = document.getElementById('landing-year');
  let lastFocusedElement = null;
  let authBusy = false;

  const roleLabels = {
    owner: 'Owner',
    admin: 'Ligaleitung',
    steward: 'Steward'
  };

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
      cursor: 'pointer',
      zIndex: '2'
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

  function setFeedback(message = '', level = 'info') {
    if (!feedback) return;
    feedback.hidden = !message;
    feedback.textContent = message;
    feedback.dataset.level = level;
  }

  function setLoginButtons(session) {
    document.querySelectorAll('[data-login-button-label]').forEach((label) => {
      label.textContent = session?.user ? 'Admin öffnen' : 'Login';
    });
  }

  function setFormVisible(visible) {
    if (form) form.hidden = !visible;
  }

  function clearLeaguePicker() {
    if (!leaguePicker) return;
    leaguePicker.hidden = true;
    leaguePicker.replaceChildren();
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    setFeedback('');
    lastFocusedElement?.focus?.({ preventScroll: true });
  }

  async function getSession() {
    if (!window.supabaseClient?.auth) return null;
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  function makeLeagueLink(league) {
    const link = document.createElement('a');
    link.className = 'login-league-link';
    link.href = `admin.html?league=${encodeURIComponent(league.slug)}`;

    const copy = document.createElement('div');
    const name = document.createElement('strong');
    const role = document.createElement('small');
    name.textContent = league.name || league.slug || 'Rennliga';
    role.textContent = roleLabels[league.role] || league.role || 'Zugang';
    copy.append(name, role);

    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    link.append(copy, arrow);
    return link;
  }

  async function fetchAccessibleLeagues(session) {
    if (!session?.user?.id) return [];

    const membershipResponse = await window.supabaseClient
      .from('league_members')
      .select('league_id, role')
      .eq('user_id', session.user.id)
      .in('role', ['owner', 'admin', 'steward']);

    if (membershipResponse.error) throw membershipResponse.error;
    const memberships = membershipResponse.data || [];
    if (!memberships.length) return [];

    const roleByLeagueId = new Map(memberships.map((entry) => [String(entry.league_id), entry.role]));
    const leagueIds = memberships.map((entry) => entry.league_id);
    const leagueResponse = await window.supabaseClient
      .from('leagues')
      .select('id, name, slug, status')
      .in('id', leagueIds)
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (leagueResponse.error) throw leagueResponse.error;
    return (leagueResponse.data || []).map((league) => ({
      ...league,
      role: roleByLeagueId.get(String(league.id)) || 'admin'
    }));
  }

  async function isPlatformOwner() {
    try {
      const { data, error } = await window.supabaseClient.rpc('is_platform_owner');
      return !error && data === true;
    } catch (_) {
      return false;
    }
  }

  async function renderSessionState(session) {
    setLoginButtons(session);
    clearLeaguePicker();

    if (!session?.user) {
      setFormVisible(true);
      if (intro) intro.textContent = 'Melde dich mit deinem RCC-Account an. Danach kannst du direkt deine Rennliga auswählen.';
      return;
    }

    setFormVisible(false);
    if (intro) intro.textContent = `Angemeldet als ${session.user.email || 'RCC-Nutzer'}. Wähle die Liga, die du verwalten möchtest.`;
    setFeedback('Ligen werden geladen …');

    try {
      const leagues = await fetchAccessibleLeagues(session);
      const platformOwner = leagues.length ? false : await isPlatformOwner();
      setFeedback('');

      if (!leaguePicker) return;
      leaguePicker.hidden = false;

      const heading = document.createElement('strong');
      heading.textContent = leagues.length ? 'Deine Rennligen' : 'Admin-Zugang';
      const list = document.createElement('div');
      list.className = 'login-league-picker__list';

      leagues.forEach((league) => list.appendChild(makeLeagueLink(league)));

      if (!leagues.length && platformOwner) {
        list.appendChild(makeLeagueLink({ name: 'Race Control Center', slug: 'rcc', role: 'owner' }));
      }

      if (!leagues.length && !platformOwner) {
        const empty = document.createElement('div');
        empty.className = 'login-feedback';
        empty.textContent = 'Deinem Account ist aktuell keine administrierbare Rennliga zugeordnet.';
        list.appendChild(empty);
      }

      const switchAccount = document.createElement('button');
      switchAccount.type = 'button';
      switchAccount.className = 'landing-button landing-button--ghost';
      switchAccount.textContent = 'Anderen Account verwenden';
      switchAccount.addEventListener('click', async () => {
        await window.supabaseClient.auth.signOut().catch(() => null);
        clearLeaguePicker();
        setFeedback('');
        setFormVisible(true);
        if (intro) intro.textContent = 'Melde dich mit deinem RCC-Account an. Danach kannst du direkt deine Rennliga auswählen.';
        emailInput?.focus?.();
      });

      leaguePicker.append(heading, list, switchAccount);
    } catch (error) {
      console.error('Landing league lookup failed:', error);
      clearLeaguePicker();
      setFeedback('Deine Rennligen konnten gerade nicht geladen werden. Öffne alternativ das Admin Center und versuche es erneut.', 'error');

      if (leaguePicker) {
        leaguePicker.hidden = false;
        const fallback = document.createElement('a');
        fallback.className = 'landing-button landing-button--ghost';
        fallback.href = 'admin.html?league=rcc';
        fallback.textContent = 'Admin Center öffnen';
        leaguePicker.appendChild(fallback);
      }
    }
  }

  async function openModal(trigger) {
    if (!modal) return;
    lastFocusedElement = trigger || document.activeElement;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setFeedback('');

    try {
      const session = await getSession();
      await renderSessionState(session);
      if (!session?.user) emailInput?.focus?.({ preventScroll: true });
      else modal.querySelector('.login-league-link, .landing-button')?.focus?.({ preventScroll: true });
    } catch (error) {
      console.error('Landing session check failed:', error);
      setFormVisible(true);
      setFeedback('Die Session konnte nicht geprüft werden. Du kannst dich trotzdem neu anmelden.', 'error');
      emailInput?.focus?.({ preventScroll: true });
    }
  }

  async function signIn(event) {
    event.preventDefault();
    if (authBusy || !window.supabaseClient?.auth) return;
    const email = String(emailInput?.value || '').trim();
    const password = String(passwordInput?.value || '');
    if (!email || !password) return;

    authBusy = true;
    const submit = form?.querySelector('button[type="submit"]');
    const originalLabel = submit?.innerHTML || '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Anmeldung läuft …';
    }
    setFeedback('');

    try {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      passwordInput.value = '';
      await renderSessionState(data?.session || null);
    } catch (error) {
      console.error('Landing login failed:', error);
      setFeedback('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.', 'error');
    } finally {
      authBusy = false;
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = originalLabel;
      }
    }
  }

  function bindSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (event) => {
        const target = document.querySelector(anchor.getAttribute('href'));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      });
    });
  }

  function bindEvents() {
    installPasswordToggle(passwordInput);

    document.querySelectorAll('[data-login-open]').forEach((button) => {
      button.addEventListener('click', () => openModal(button));
    });
    document.querySelectorAll('[data-login-close]').forEach((button) => {
      button.addEventListener('click', closeModal);
    });
    form?.addEventListener('submit', signIn);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
    });

    window.supabaseClient?.auth?.onAuthStateChange?.((_event, session) => {
      setLoginButtons(session);
    });
  }

  async function init() {
    if (year) year.textContent = String(new Date().getFullYear());
    bindSmoothAnchors();
    bindEvents();
    try {
      setLoginButtons(await getSession());
    } catch (_) {
      setLoginButtons(null);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();