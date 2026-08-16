(() => {
  'use strict';

  if (document.body?.dataset?.page !== 'account-setup') return;

  const PENDING_KEY = 'rcc.pendingLeagueRegistration.v1';
  const META_NAME = 'rcc_pending_league_name';
  const META_SLUG = 'rcc_pending_league_slug';
  const META_PUBLIC = 'rcc_pending_league_public';
  const RESERVED_SLUGS = new Set([
    'admin', 'api', 'app', 'auth', 'login', 'logout', 'signup', 'register',
    'support', 'help', 'www', 'racecontrolcenter', 'racevora'
  ]);

  const status = document.getElementById('setup-status');
  const spinner = document.getElementById('setup-spinner');
  const errorBox = document.getElementById('setup-error');
  const errorMessage = document.getElementById('setup-error-message');
  const retryButton = document.getElementById('setup-retry');
  const steps = {
    session: document.getElementById('setup-step-session'),
    league: document.getElementById('setup-step-league'),
    permissions: document.getElementById('setup-step-permissions')
  };

  let runningPromise = null;

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

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function setStep(activeName) {
    const order = ['session', 'league', 'permissions'];
    const activeIndex = order.indexOf(activeName);
    order.forEach((name, index) => {
      const element = steps[name];
      if (!element) return;
      if (index < activeIndex) element.dataset.state = 'done';
      else if (index === activeIndex) element.dataset.state = 'active';
      else element.removeAttribute('data-state');
    });
  }

  function markAllDone() {
    Object.values(steps).forEach((element) => {
      if (element) element.dataset.state = 'done';
    });
    if (spinner) spinner.dataset.state = 'done';
  }

  function clearError() {
    if (errorBox) errorBox.hidden = true;
    if (errorMessage) errorMessage.textContent = '';
    if (spinner) spinner.removeAttribute('data-state');
  }

  function friendlyError(error) {
    const message = String(error?.message || error || '');
    if (/League name already exists/i.test(message)) {
      return 'Dieser Liganame wird bereits verwendet. Bitte gehe zurück zur Registrierung und wähle einen anderen Namen.';
    }
    if (/League slug already exists/i.test(message)) {
      return 'Diese Liga-URL ist bereits vergeben. Bitte gehe zurück zur Registrierung und wähle einen anderen Kurznamen.';
    }
    if (/league slug is reserved|This league slug is reserved/i.test(message)) {
      return 'Diese Liga-URL ist für RaceVora reserviert. Bitte wähle einen anderen Kurznamen.';
    }
    if (/already assigned to a league/i.test(message)) {
      return 'Dieser Account ist bereits einer Rennliga zugeordnet. Öffne deine bestehende Liga oder verwende einen anderen Account.';
    }
    if (/Authentication required|session|auth/i.test(message)) {
      return 'Die Anmeldung konnte nicht bestätigt werden. Öffne den Bestätigungslink erneut oder starte die Registrierung neu.';
    }
    return message || 'RaceVora konnte die Einrichtung nicht abschließen. Bitte versuche es erneut.';
  }

  function showError(error) {
    console.error('RaceVora account setup failed:', error);
    setStatus('Die Einrichtung wurde angehalten.');
    if (spinner) spinner.dataset.state = 'error';
    if (errorMessage) errorMessage.textContent = friendlyError(error);
    if (errorBox) errorBox.hidden = false;
  }

  function clearPending() {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch (_) {
      // Local storage is optional.
    }
  }

  async function clearPendingMetadata() {
    try {
      await window.supabaseClient.auth.updateUser({
        data: { [META_NAME]: null, [META_SLUG]: null, [META_PUBLIC]: null }
      });
    } catch (error) {
      console.warn('RaceVora registration metadata cleanup failed:', error);
    }
  }

  async function getSession() {
    if (!window.supabaseClient?.auth) throw new Error('RaceVora Auth ist nicht verfügbar.');

    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;
    if (data?.session?.user) return data.session;

    return new Promise((resolve, reject) => {
      let finished = false;
      let subscription = null;
      const timeout = window.setTimeout(() => {
        if (finished) return;
        finished = true;
        subscription?.unsubscribe?.();
        reject(new Error('Die sichere Session aus dem Bestätigungslink konnte nicht geladen werden.'));
      }, 8000);

      const { data: listener } = window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (finished || !session?.user) return;
        if (!['SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED'].includes(event)) return;
        finished = true;
        window.clearTimeout(timeout);
        subscription?.unsubscribe?.();
        resolve(session);
      });

      subscription = listener?.subscription || null;
    });
  }

  async function sha256Key(value) {
    if (!window.crypto?.subtle || typeof TextEncoder === 'undefined') {
      throw new Error('Die sichere Liga-Prüfung wird von diesem Browser nicht unterstützt.');
    }
    const bytes = new TextEncoder().encode(String(value || ''));
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function checkAvailability(pending) {
    const normalizedName = String(pending?.leagueName || '').trim().toLowerCase();
    const normalizedSlug = slugify(pending?.leagueSlug || '');
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
    if (rows.some((row) => row?.name_key === nameKey)) throw new Error('League name already exists');
    if (slugReserved) throw new Error('This league slug is reserved');
    if (rows.some((row) => row?.slug_key === slugKey)) throw new Error('League slug already exists');
  }

  async function findExistingPendingLeague(session, pending) {
    if (!session?.user?.id || !pending?.leagueSlug) return null;

    const { data: league, error: leagueError } = await window.supabaseClient
      .from('leagues')
      .select('id, name, slug, is_public, status, settings')
      .eq('slug', pending.leagueSlug)
      .maybeSingle();

    if (leagueError && leagueError.code !== 'PGRST116') throw leagueError;
    if (!league) return null;

    const { data: membership, error: membershipError } = await window.supabaseClient
      .from('league_members')
      .select('league_id, user_id, role')
      .eq('league_id', league.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (membershipError && membershipError.code !== 'PGRST116') throw membershipError;
    if (!membership || !['admin', 'owner'].includes(membership.role)) return null;

    return { ...league, role: membership.role };
  }

  async function findExistingLeague(session) {
    if (!session?.user?.id) return null;

    const { data: memberships, error } = await window.supabaseClient
      .from('league_members')
      .select('league_id, role, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    const membership = Array.isArray(memberships) ? memberships[0] : null;
    if (!membership?.league_id) return null;

    const { data: league, error: leagueError } = await window.supabaseClient
      .from('leagues')
      .select('id, name, slug, is_public, status, settings')
      .eq('id', membership.league_id)
      .maybeSingle();

    if (leagueError && leagueError.code !== 'PGRST116') throw leagueError;
    if (!league) return null;
    return { ...league, role: membership.role };
  }

  async function createLeague(session, pending) {
    const { data, error } = await window.supabaseClient.rpc('create_league', {
      p_name: pending.leagueName,
      p_slug: pending.leagueSlug,
      p_is_public: Boolean(pending.isPublic)
    });
    if (error) throw error;

    const league = Array.isArray(data) ? data[0] : data;
    if (!league?.slug || !['admin', 'owner'].includes(league.role)) {
      throw new Error('Die Liga-Leitung konnte nicht korrekt angelegt werden.');
    }
    return league;
  }

  function persistLeagueContext(league) {
    try {
      sessionStorage.setItem('rcc.activeLeagueSlug.v1', league.slug);
      sessionStorage.setItem('rcc.lastTenantSlug.v1', league.slug);
    } catch (_) {
      // Session storage is optional.
    }
  }

  async function finish(league) {
    setStep('permissions');
    setStatus('Berechtigungen werden geladen …');

    if (!league?.slug || !['admin', 'owner'].includes(league.role)) {
      throw new Error('Die erforderliche Liga-Leitung-Berechtigung fehlt.');
    }

    persistLeagueContext(league);
    clearPending();
    await clearPendingMetadata();

    markAllDone();
    setStatus('Alles bereit. Das RaceVora-Onboarding wird geöffnet …');

    const target = new URL('admin.html', window.location.href);
    target.searchParams.set('league', league.slug);
    target.searchParams.set('onboarding', '1');
    window.setTimeout(() => window.location.replace(target.toString()), 250);
  }

  async function run() {
    if (runningPromise) return runningPromise;

    runningPromise = (async () => {
      clearError();
      setStep('session');
      setStatus('Sichere Anmeldung wird bestätigt …');

      const session = await getSession();
      if (!session?.user?.id) throw new Error('Authentication required');

      setStep('league');
      setStatus('Rennliga und Konto werden geprüft …');

      const pending = pendingForSession(session);
      if (!pending) {
        const existing = await findExistingLeague(session);
        if (existing?.slug && ['admin', 'owner'].includes(existing.role)) {
          await finish(existing);
          return;
        }
        throw new Error('Die begonnenen Liga-Daten konnten nicht wiederhergestellt werden. Bitte starte die Registrierung erneut.');
      }

      const sessionEmail = String(session.user.email || '').trim().toLowerCase();
      if (pending.email && sessionEmail !== pending.email) {
        throw new Error('Der angemeldete Account passt nicht zur begonnenen Registrierung.');
      }

      const existingPendingLeague = await findExistingPendingLeague(session, pending);
      if (existingPendingLeague) {
        await finish(existingPendingLeague);
        return;
      }

      setStatus('Liga-Name und URL werden geprüft …');
      await checkAvailability(pending);

      setStatus('Deine Rennliga wird angelegt …');
      const league = await createLeague(session, pending);
      await finish(league);
    })()
      .catch(showError)
      .finally(() => {
        runningPromise = null;
      });

    return runningPromise;
  }

  retryButton?.addEventListener('click', () => {
    run().catch(() => {});
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => run().catch(() => {}), { once: true });
  } else {
    run().catch(() => {});
  }
})();
