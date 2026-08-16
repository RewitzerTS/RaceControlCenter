(() => {
  const PENDING_REGISTRATION_KEY = 'rcc.pendingLeagueRegistration.v1';
  const statusEl = document.getElementById('password-setup-status');
  const formEl = document.getElementById('password-setup-form');
  const feedbackEl = document.getElementById('password-setup-feedback');
  const saveButton = document.getElementById('save-password-btn');

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function showFeedback(message, isError = false) {
    if (!feedbackEl) return;
    feedbackEl.hidden = !message;
    feedbackEl.textContent = message || '';
    feedbackEl.classList.toggle('notice-error', Boolean(isError));
  }

  function getPendingRegistration() {
    try {
      const raw = localStorage.getItem(PENDING_REGISTRATION_KEY);
      if (!raw) return null;
      const pending = JSON.parse(raw);
      if (!pending?.email || !pending?.leagueName || !pending?.leagueSlug) return null;
      return pending;
    } catch (_) {
      return null;
    }
  }

  function getLeagueSlug() {
    return String(new URLSearchParams(window.location.search).get('league') || 'rcc')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') || 'rcc';
  }

  async function resolveDestination(userId) {
    const slug = getLeagueSlug();
    const { data: league } = await window.supabaseClient
      .from('leagues')
      .select('id, slug')
      .eq('slug', slug)
      .maybeSingle();

    if (!league?.id) return `index.html?league=${encodeURIComponent(slug)}`;

    const { data: membership } = await window.supabaseClient
      .from('league_members')
      .select('role')
      .eq('league_id', league.id)
      .eq('user_id', userId)
      .maybeSingle();

    const target = ['owner', 'admin', 'steward'].includes(membership?.role) ? 'admin.html' : 'index.html';
    return `${target}?league=${encodeURIComponent(slug)}`;
  }

  async function initialize() {
    try {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) throw error;
      const session = data?.session;
      if (!session?.user) {
        setStatus('Der Einladungslink ist ungültig oder abgelaufen. Bitte lass dir eine neue Einladung senden.');
        return;
      }

      const pending = getPendingRegistration();
      const sessionEmail = String(session.user.email || '').trim().toLowerCase();
      if (pending && sessionEmail === String(pending.email || '').trim().toLowerCase()) {
        setStatus('E-Mail bestätigt. Deine Registrierung wird fortgesetzt …');
        const target = new URL('register.html?confirmed=1', window.location.href);
        window.location.replace(target.toString());
        return;
      }

      setStatus(`Account erkannt: ${session.user.email || 'eingeladener Nutzer'}`);
      if (formEl) formEl.hidden = false;
    } catch (error) {
      console.error(error);
      setStatus('Die Einladung konnte nicht verarbeitet werden.');
    }
  }

  async function savePassword() {
    const password = String(document.getElementById('new-password')?.value || '');
    const confirmation = String(document.getElementById('confirm-password')?.value || '');

    if (password.length < 10) {
      showFeedback('Das Passwort muss mindestens 10 Zeichen lang sein.', true);
      return;
    }
    if (password !== confirmation) {
      showFeedback('Die Passwörter stimmen nicht überein.', true);
      return;
    }

    if (saveButton) saveButton.disabled = true;
    showFeedback('Passwort wird gespeichert...');

    try {
      const { data: sessionData } = await window.supabaseClient.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user?.id) throw new Error('Keine aktive Einladungssession gefunden.');

      const { error } = await window.supabaseClient.auth.updateUser({ password });
      if (error) throw error;

      showFeedback('Passwort wurde gespeichert. Du wirst weitergeleitet.');
      const destination = await resolveDestination(user.id);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      window.location.assign(destination);
    } catch (error) {
      console.error(error);
      showFeedback(`Passwort konnte nicht gespeichert werden: ${error.message || 'Unbekannter Fehler'}`, true);
      if (saveButton) saveButton.disabled = false;
    }
  }

  saveButton?.addEventListener('click', savePassword);
  document.addEventListener('DOMContentLoaded', initialize);
})();
