(() => {
  'use strict';

  if (window.RCCTrackNotes) return;

  let currentTrackKey = '';
  let currentUser = null;
  let currentLeague = null;
  let host = null;
  let textarea = null;
  let feedback = null;
  let saveButton = null;
  let loadedKey = '';
  let loadTimer = null;

  function ensureStyles() {
    if (document.querySelector('link[data-rcc-driver-wizard="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-driver-wizard.css';
    link.dataset.rccDriverWizard = 'true';
    document.head.appendChild(link);
  }

  function leagueSlug() {
    const params = new URLSearchParams(location.search);
    const query = String(params.get('league') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (query) return query;
    try {
      return String(sessionStorage.getItem('rcc.activeLeagueSlug.v1') || 'rcc').trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'rcc';
    } catch (_) {
      return 'rcc';
    }
  }

  function trackKey() {
    const select = document.getElementById('track-profile-select');
    const selected = String(select?.value || '').trim();
    if (selected) return selected;
    return String(new URLSearchParams(location.search).get('track') || '').trim();
  }

  function setFeedback(message = '', isError = false) {
    if (!feedback) return;
    feedback.hidden = !message;
    feedback.textContent = message;
    feedback.classList.toggle('notice-error', Boolean(isError));
  }

  function formatUpdated(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch (_) {
      return '';
    }
  }

  async function resolveContext() {
    const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    currentUser = sessionData?.session?.user || null;
    if (!currentUser?.id) return false;

    const slug = leagueSlug();
    const { data: league, error: leagueError } = await window.supabaseClient
      .from('leagues')
      .select('id, name, slug')
      .eq('slug', slug)
      .maybeSingle();
    if (leagueError) throw leagueError;
    currentLeague = league || null;
    return Boolean(currentLeague?.id);
  }

  function ensurePanel() {
    if (host?.isConnected) return true;
    const content = document.getElementById('track-profile-content');
    const firstSplit = content?.querySelector('.driver-profile-split');
    if (!content || !firstSplit) return false;

    host = document.createElement('section');
    host.className = 'driver-panel rcc-track-note-panel';
    host.hidden = true;
    host.innerHTML = `
      <div class="driver-panel-heading">
        <div><span class="eyebrow">Privat</span><h3>Meine Streckennotizen</h3></div>
        <span class="muted">Nur für dich sichtbar</span>
      </div>
      <p class="muted">Speichere Setups, Bremspunkte, Strategiehinweise oder persönliche Erinnerungen zu dieser Strecke. Die Notiz gehört nur zu deinem RaceVora-Account in dieser Liga.</p>
      <textarea id="rcc-track-note-text" maxlength="5000" placeholder="z. B. T1 früh bremsen · Medium → Hard funktioniert gut · ERS vor DRS-Zone sparen"></textarea>
      <div class="card-actions section-spacer-top"><button type="button" class="btn primary" id="rcc-track-note-save">Notiz speichern</button></div>
      <div id="rcc-track-note-feedback" class="notice" hidden></div>
      <div id="rcc-track-note-updated" class="rcc-track-note-meta"></div>`;
    firstSplit.insertAdjacentElement('afterend', host);
    textarea = host.querySelector('#rcc-track-note-text');
    feedback = host.querySelector('#rcc-track-note-feedback');
    saveButton = host.querySelector('#rcc-track-note-save');
    saveButton?.addEventListener('click', save);
    return true;
  }

  async function load() {
    if (!window.supabaseClient || !ensurePanel()) return;
    const nextTrackKey = trackKey();
    if (!nextTrackKey) return;
    currentTrackKey = nextTrackKey;

    try {
      if (!currentUser?.id || !currentLeague?.id) {
        const hasContext = await resolveContext();
        if (!hasContext) {
          host.hidden = true;
          return;
        }
      }
      host.hidden = false;
      if (loadedKey === `${currentLeague.id}:${currentUser.id}:${currentTrackKey}`) return;
      setFeedback('Notiz wird geladen …');
      const { data, error } = await window.supabaseClient
        .from('driver_track_notes')
        .select('note, updated_at')
        .eq('league_id', currentLeague.id)
        .eq('user_id', currentUser.id)
        .eq('track_key', currentTrackKey)
        .maybeSingle();
      if (error && !['PGRST116', 'PGRST205', '42P01'].includes(error.code)) throw error;
      textarea.value = data?.note || '';
      const updated = host.querySelector('#rcc-track-note-updated');
      if (updated) updated.textContent = data?.updated_at ? `Zuletzt gespeichert: ${formatUpdated(data.updated_at)}` : 'Noch keine Notiz gespeichert.';
      loadedKey = `${currentLeague.id}:${currentUser.id}:${currentTrackKey}`;
      setFeedback('');
    } catch (error) {
      console.error('RaceVora track note load:', error);
      if (error?.code === 'PGRST205' || error?.code === '42P01') {
        host.hidden = true;
        return;
      }
      setFeedback('Deine Streckennotiz konnte nicht geladen werden.', true);
    }
  }

  async function save() {
    if (!currentUser?.id || !currentLeague?.id || !currentTrackKey || !textarea) return;
    const note = String(textarea.value || '').trim();
    saveButton.disabled = true;
    setFeedback('Notiz wird gespeichert …');
    try {
      if (!note) {
        const { error } = await window.supabaseClient
          .from('driver_track_notes')
          .delete()
          .eq('league_id', currentLeague.id)
          .eq('user_id', currentUser.id)
          .eq('track_key', currentTrackKey);
        if (error) throw error;
        textarea.value = '';
        host.querySelector('#rcc-track-note-updated').textContent = 'Keine Notiz gespeichert.';
        setFeedback('Notiz entfernt.');
        return;
      }

      const updatedAt = new Date().toISOString();
      const { error } = await window.supabaseClient
        .from('driver_track_notes')
        .upsert({
          league_id: currentLeague.id,
          user_id: currentUser.id,
          track_key: currentTrackKey,
          note,
          updated_at: updatedAt
        }, { onConflict: 'user_id,league_id,track_key' });
      if (error) throw error;
      textarea.value = note;
      host.querySelector('#rcc-track-note-updated').textContent = `Zuletzt gespeichert: ${formatUpdated(updatedAt)}`;
      setFeedback('Notiz gespeichert.');
    } catch (error) {
      console.error('RaceVora track note save:', error);
      setFeedback(`Notiz konnte nicht gespeichert werden: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      saveButton.disabled = false;
    }
  }

  function scheduleLoad() {
    window.clearTimeout(loadTimer);
    loadTimer = window.setTimeout(() => {
      const key = trackKey();
      if (key !== currentTrackKey) loadedKey = '';
      load().catch(() => undefined);
    }, 40);
  }

  function init() {
    if (document.body?.dataset.page !== 'strecken-profil') return false;
    ensureStyles();
    ensurePanel();
    scheduleLoad();
    document.addEventListener('rcc:page-content-ready', (event) => {
      if (!event?.detail?.page || event.detail.page === 'strecken-profil') scheduleLoad();
    });
    document.getElementById('track-profile-select')?.addEventListener('change', scheduleLoad);
    return true;
  }

  window.RCCTrackNotes = { init, load, save };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();