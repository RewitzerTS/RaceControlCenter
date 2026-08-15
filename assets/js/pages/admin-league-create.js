(() => {
  let initialized = false;
  const modulePromises = new Map();

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
    if (modulePromises.has(globalName)) return modulePromises.get(globalName);

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        if (!window[globalName]) {
          reject(new Error(errorMessage));
          return;
        }
        resolve(window[globalName]);
      };
      script.onerror = () => reject(new Error(errorMessage));
      document.head.appendChild(script);
    }).finally(() => modulePromises.delete(globalName));

    modulePromises.set(globalName, promise);
    return promise;
  }

  const loadWizardDialogModule = () => loadScriptModule('RCCWizardDialog', 'assets/js/components/rcc-wizard-dialog.js', 'Wizard-Dialog konnte nicht geladen werden.');
  const loadResultsWorkflowModule = () => loadScriptModule('RCCResultsWorkflow', 'assets/js/components/rcc-results-workflow.js', 'Ergebnis-Workflow konnte nicht geladen werden.');
  const loadBrandingOnboardingModule = () => loadScriptModule('RCCLeagueBrandingOnboarding', 'assets/js/pages/admin-league-branding-onboarding.js', 'Liga-Branding-Einrichtung konnte nicht geladen werden.');
  const loadScoringModule = () => loadScriptModule('RCCLeagueScoring', 'assets/js/pages/admin-league-scoring.js', 'Liga-Punktesystem konnte nicht geladen werden.');
  const loadSeasonStructureModule = () => loadScriptModule('RCCOnboardingSeasonStructure', 'assets/js/pages/admin-onboarding-season-structure.js', 'Saisonstruktur-Modul konnte nicht geladen werden.');
  const loadOnboardingContextGuard = () => loadScriptModule('RCCOnboardingContextGuard', 'assets/js/pages/admin-onboarding-context-guard.js', 'Liga-Kontextschutz konnte nicht geladen werden.');
  const loadSubstitutionModule = () => loadScriptModule('RCCRaceSubstitutions', 'assets/js/pages/admin-race-substitutions.js', 'Ersatzfahrer-Modul konnte nicht geladen werden.');
  const loadRosterModule = () => loadScriptModule('RCCSeasonRoster', 'assets/js/pages/admin-season-roster.js', 'Saisonkader-Modul konnte nicht geladen werden.');
  const loadNextSeasonModule = () => loadScriptModule('RCCNextSeason', 'assets/js/pages/admin-next-season.js', 'Saisonstart-Modul konnte nicht geladen werden.');
  const loadFinalizeModule = () => loadScriptModule('RCCSeasonFinalize', 'assets/js/pages/admin-season-finalize.js', 'Saisonabschluss-Modul konnte nicht geladen werden.');

  async function isPlatformOwner() {
    const { data, error } = await window.supabaseClient.rpc('is_platform_owner');
    return !error && data === true;
  }

  function ensurePanel(platformOwner) {
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
        <div class="notice">
          ${platformOwner
            ? 'Du erhältst als Plattform-Owner automatisch Owner-Zugriff auf die neue Liga.'
            : 'Du wirst automatisch Ligaleitung der neuen Liga.'}
          Nach dem Erstellen richtest du nur noch Name, Links, Farbschema und Logo ein. Rennkalender, Saison, Fahrer und Teams werden separat verwaltet.
        </div>
        <div class="form-grid section-spacer-top">
          <div class="field"><label for="league-create-name">Liganame</label><input id="league-create-name" maxlength="80" placeholder="z. B. German Racing League"></div>
          <div class="field"><label for="league-create-slug">Kurzname / URL</label><input id="league-create-slug" maxlength="50" placeholder="german-racing-league"></div>
          <div class="field"><label for="league-create-visibility">Sichtbarkeit</label><select id="league-create-visibility"><option value="public" selected>Öffentlich</option><option value="private">Privat</option></select></div>
        </div>
        <div class="notice">Die Liga-Adresse verwendet den Kurznamen, z. B. <strong>?league=german-racing-league</strong>.</div>
        <div class="card-actions"><button type="button" class="button-primary" id="league-create-btn">Liga erstellen & Branding einrichten</button></div>
        <div id="league-create-feedback" class="notice" hidden></div>
      </section>`;

    layout.appendChild(panel);
    const nameInput = panel.querySelector('#league-create-name');
    const slugInput = panel.querySelector('#league-create-slug');
    let slugWasEdited = false;
    slugInput?.addEventListener('input', () => { slugWasEdited = true; slugInput.value = slugify(slugInput.value); });
    nameInput?.addEventListener('input', () => { if (!slugWasEdited && slugInput) slugInput.value = slugify(nameInput.value); });
    panel.querySelector('#league-create-btn')?.addEventListener('click', createLeague);
  }

  async function createLeague() {
    const name = String(document.getElementById('league-create-name')?.value || '').trim();
    const slug = slugify(document.getElementById('league-create-slug')?.value || '');
    const isPublic = document.getElementById('league-create-visibility')?.value !== 'private';
    const button = document.getElementById('league-create-btn');
    if (name.length < 3) return showFeedback('Bitte einen Liganamen mit mindestens 3 Zeichen eingeben.', true);
    if (slug.length < 3) return showFeedback('Bitte einen gültigen Kurzname mit mindestens 3 Zeichen eingeben.', true);
    if (button) button.disabled = true;
    showFeedback('Liga wird erstellt …');
    try {
      const { data, error } = await window.supabaseClient.rpc('create_league', { p_name: name, p_slug: slug, p_is_public: isPublic });
      if (error) throw error;
      const league = Array.isArray(data) ? data[0] : data;
      if (!league?.slug) throw new Error('Die neue Liga konnte nicht geladen werden.');
      showFeedback(`${league.name} wurde erstellt. Branding-Assistent wird geöffnet …`);
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

  async function initSeparateAdminModules() {
    const scoring = await loadScoringModule().catch(console.warn); await scoring?.init?.();
    const seasonStructure = await loadSeasonStructureModule().catch(console.warn); await seasonStructure?.init?.();
    const substitutions = await loadSubstitutionModule().catch(console.warn); await substitutions?.init?.();
    const roster = await loadRosterModule().catch(console.warn); await roster?.init?.();
    const nextSeason = await loadNextSeasonModule().catch(console.warn); await nextSeason?.init?.();
    const finalize = await loadFinalizeModule().catch(console.warn); await finalize?.init?.();
  }

  async function init() {
    if (initialized) return;
    const { data } = await window.supabaseClient.auth.getSession();
    if (!data?.session?.user) return;
    const context = await window.RCCData?.getLeagueContext?.().catch(() => null);
    const platformOwner = await isPlatformOwner();
    const canCreate = platformOwner || ['owner', 'admin'].includes(context?.role);
    if (!canCreate) {
      document.getElementById('admin-section-create-league')?.remove();
      initialized = true;
      return;
    }
    ensurePanel(platformOwner);
    const contextGuard = await loadOnboardingContextGuard().catch(console.warn); await contextGuard?.init?.();
    const wizardDialog = await loadWizardDialogModule().catch(console.warn); wizardDialog?.ensureLeagueCreateLauncher?.();
    const resultsWorkflow = await loadResultsWorkflowModule().catch(console.warn); resultsWorkflow?.ensureLauncher?.();
    const brandingOnboarding = await loadBrandingOnboardingModule().catch(console.warn); await brandingOnboarding?.init?.();
    await initSeparateAdminModules();
    initialized = true;
  }

  window.RCCLeagueCreate = { init, slugify };
})();
