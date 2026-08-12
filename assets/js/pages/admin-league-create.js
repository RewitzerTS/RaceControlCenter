(() => {
  let initialized = false;
  let onboardingModulePromise = null;
  let scoringModulePromise = null;
  let seasonStructureModulePromise = null;

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

  function showFeedback(message, isError = false) {
    const el = document.getElementById('league-create-feedback');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
    el.classList.toggle('notice-error', Boolean(isError));
  }

  function loadScriptModule(globalName, src, errorMessage) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve(window[globalName]);
      script.onerror = () => reject(new Error(errorMessage));
      document.head.appendChild(script);
    });
  }

  async function loadOnboardingModule() {
    if (window.RCCLeagueOnboarding) return window.RCCLeagueOnboarding;
    if (onboardingModulePromise) return onboardingModulePromise;
    onboardingModulePromise = loadScriptModule(
      'RCCLeagueOnboarding',
      'assets/js/pages/admin-league-onboarding.js',
      'Liga-Onboarding konnte nicht geladen werden.'
    ).finally(() => { onboardingModulePromise = null; });
    return onboardingModulePromise;
  }

  async function loadScoringModule() {
    if (window.RCCLeagueScoring) return window.RCCLeagueScoring;
    if (scoringModulePromise) return scoringModulePromise;
    scoringModulePromise = loadScriptModule(
      'RCCLeagueScoring',
      'assets/js/pages/admin-league-scoring.js',
      'Liga-Punktesystem konnte nicht geladen werden.'
    ).finally(() => { scoringModulePromise = null; });
    return scoringModulePromise;
  }

  async function loadSeasonStructureModule() {
    if (window.RCCOnboardingSeasonStructure) return window.RCCOnboardingSeasonStructure;
    if (seasonStructureModulePromise) return seasonStructureModulePromise;
    seasonStructureModulePromise = loadScriptModule(
      'RCCOnboardingSeasonStructure',
      'assets/js/pages/admin-onboarding-season-structure.js',
      'Saisonstruktur-Modul konnte nicht geladen werden.'
    ).finally(() => { seasonStructureModulePromise = null; });
    return seasonStructureModulePromise;
  }

  function ensurePanel() {
    if (document.getElementById('admin-section-create-league')) return;
    const layout = document.querySelector('.admin-layout');
    if (!layout) return;

    const panel = document.createElement('details');
    panel.className = 'panel admin-panel-wide';
    panel.id = 'admin-section-create-league';
    panel.innerHTML = `
      <summary><strong>Neue Liga erstellen</strong></summary>
      <section class="panel admin-panel-wide admin-panel-accent">
        <h3>Eigene Rennliga anlegen</h3>
        <div class="notice">Du wirst automatisch Owner der neuen Liga. Danach startet direkt der Einrichtungsassistent.</div>
        <div class="form-grid section-spacer-top">
          <div class="field">
            <label for="league-create-name">Liganame</label>
            <input id="league-create-name" maxlength="80" placeholder="z. B. German Racing League">
          </div>
          <div class="field">
            <label for="league-create-slug">Kurzname / URL</label>
            <input id="league-create-slug" maxlength="50" placeholder="german-racing-league">
          </div>
          <div class="field">
            <label for="league-create-visibility">Sichtbarkeit nach Veröffentlichung</label>
            <select id="league-create-visibility">
              <option value="public" selected>Öffentlich</option>
              <option value="private">Privat</option>
            </select>
          </div>
        </div>
        <div class="notice">Die Liga bleibt während der Einrichtung unveröffentlicht. Die Liga-Adresse verwendet später den Kurzname, z. B. <strong>?league=german-racing-league</strong>.</div>
        <div class="card-actions">
          <button type="button" class="button-primary" id="league-create-btn">Liga erstellen & einrichten</button>
        </div>
        <div id="league-create-feedback" class="notice" hidden></div>
      </section>`;
    layout.appendChild(panel);

    const nameInput = panel.querySelector('#league-create-name');
    const slugInput = panel.querySelector('#league-create-slug');
    let slugWasEdited = false;

    slugInput?.addEventListener('input', () => {
      slugWasEdited = true;
      slugInput.value = slugify(slugInput.value);
    });
    nameInput?.addEventListener('input', () => {
      if (!slugWasEdited && slugInput) slugInput.value = slugify(nameInput.value);
    });
    panel.querySelector('#league-create-btn')?.addEventListener('click', createLeague);
  }

  async function createLeague() {
    const name = String(document.getElementById('league-create-name')?.value || '').trim();
    const slug = slugify(document.getElementById('league-create-slug')?.value || '');
    const isPublic = document.getElementById('league-create-visibility')?.value !== 'private';
    const button = document.getElementById('league-create-btn');

    if (name.length < 3) {
      showFeedback('Bitte einen Liganamen mit mindestens 3 Zeichen eingeben.', true);
      return;
    }
    if (slug.length < 3) {
      showFeedback('Bitte einen gültigen Kurzname mit mindestens 3 Zeichen eingeben.', true);
      return;
    }

    if (button) button.disabled = true;
    showFeedback('Liga wird erstellt...');

    try {
      const { data, error } = await window.supabaseClient.rpc('create_league', {
        p_name: name,
        p_slug: slug,
        p_is_public: isPublic
      });
      if (error) throw error;

      const league = Array.isArray(data) ? data[0] : data;
      if (!league?.slug) throw new Error('Die neue Liga konnte nicht geladen werden.');

      showFeedback(`${league.name} wurde erstellt. Einrichtungsassistent wird geöffnet...`);
      const url = new URL(window.location.href);
      url.searchParams.set('league', league.slug);
      url.searchParams.set('onboarding', '1');
      window.location.assign(url.toString());
    } catch (error) {
      console.error(error);
      showFeedback(`Liga konnte nicht erstellt werden: ${error.message || 'Unbekannter Fehler'}`, true);
      if (button) button.disabled = false;
    }
  }

  async function init() {
    if (initialized) return;
    const { data } = await window.supabaseClient.auth.getSession();
    if (!data?.session?.user) return;
    ensurePanel();

    const scoringModule = await loadScoringModule().catch((error) => console.warn(error));
    await scoringModule?.init?.();

    const onboardingModule = await loadOnboardingModule().catch((error) => console.warn(error));
    await onboardingModule?.init?.();

    const seasonStructureModule = await loadSeasonStructureModule().catch((error) => console.warn(error));
    await seasonStructureModule?.init?.();

    initialized = true;
  }

  window.RCCLeagueCreate = { init, slugify };
})();
