(() => {
  if (window.RCCAdminLoginGuard) return;

  const LOGIN_TIMEOUT_MS = 15000;
  let busy = false;

  function feedback(message = '', isError = false) {
    const el = document.getElementById('admin-auth-feedback');
    if (!el) return;
    el.hidden = !message;
    el.style.display = message ? 'block' : 'none';
    el.textContent = message;
    el.dataset.level = isError ? 'error' : 'info';
    el.classList.toggle('notice-error', Boolean(isError));
  }

  function setBusy(nextBusy) {
    busy = Boolean(nextBusy);
    const button = document.getElementById('admin-login-btn');
    if (!button) return;
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    button.textContent = busy ? 'Login wird geprüft …' : 'Einloggen';
  }

  function timeout(ms) {
    return new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error('Der Login hat zu lange gedauert. Bitte Verbindung prüfen und erneut versuchen.')), ms);
    });
  }

  async function login() {
    if (busy) return;

    const email = String(document.getElementById('admin-email')?.value || '').trim();
    const password = String(document.getElementById('admin-password')?.value || '');
    if (!email || !password) {
      feedback('Bitte E-Mail-Adresse und Passwort eingeben.', true);
      document.getElementById(!email ? 'admin-email' : 'admin-password')?.focus?.();
      return;
    }

    if (!window.supabaseClient?.auth?.signInWithPassword) {
      feedback('Login ist noch nicht bereit. Bitte die Seite kurz neu laden.', true);
      return;
    }

    feedback('Login wird geprüft …');
    setBusy(true);

    try {
      const result = await Promise.race([
        window.supabaseClient.auth.signInWithPassword({ email, password }),
        timeout(LOGIN_TIMEOUT_MS)
      ]);
      if (result?.error) throw result.error;

      feedback('Erfolgreich eingeloggt. Liga wird geladen …');

      // Private leagues are re-resolved by the tenant bootstrap on SIGNED_IN.
      // For public/current contexts without a reload, refresh the local shell too.
      Promise.resolve().then(async () => {
        try {
          await window.RCCData?.getLeagueContext?.({ forceRefresh: true });
          await window.refreshSessionStatus?.();
          await window.updateManualResultsVisibility?.();
        } catch (_) {
          // The private-league SIGNED_IN listener may already be navigating.
        }
      });
    } catch (error) {
      console.error('Admin login failed.', error);
      feedback(`Login fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}`, true);
    } finally {
      setBusy(false);
    }
  }

  function install() {
    if (document.documentElement.dataset.rccAdminLoginGuard === 'true') return;
    document.documentElement.dataset.rccAdminLoginGuard = 'true';

    // Capture phase makes the login usable even before admin.js has completed
    // tenant initialization and prevents a later duplicate bubble handler.
    document.addEventListener('click', (event) => {
      const button = event.target?.closest?.('#admin-login-btn');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      login();
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const target = event.target;
      if (!target?.matches?.('#admin-email, #admin-password')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      login();
    }, true);
  }

  install();
  window.RCCAdminLoginGuard = { login };
})();
