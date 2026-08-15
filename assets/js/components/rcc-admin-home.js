(() => {
  if (window.RCCAdminHome) return;

  const HOME_SECTION_ID = 'admin-section-home';
  const HOME_TAB_LABEL = 'Übersicht';
  let initialized = false;
  let originalInitAdminPage = null;

  function ensureStylesheet() {
    if (document.querySelector('link[data-rcc-admin-home="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-admin-home.css';
    link.dataset.rccAdminHome = 'true';
    document.head.appendChild(link);
  }

  function homeMarkup() {
    return `
      <summary><strong>${HOME_TAB_LABEL}</strong></summary>
      <section class="rcc-results-workflow rcc-admin-home" data-rcc-admin-home-ready="true">
        <div class="rcc-results-workflow__intro rcc-admin-home__intro">
          <div>
            <span class="eyebrow">Admin Center</span>
            <h3>Was möchtest du erledigen?</h3>
            <p class="muted">Starte direkt mit der Aufgabe, die gerade ansteht. Die bestehenden Arbeitsbereiche und Popups werden anschließend gezielt geöffnet.</p>
          </div>
        </div>

        <div class="rcc-admin-home__status-grid" aria-label="Aktueller Liga-Status">
          <article class="rcc-admin-home__status-card"><span>Saison</span><strong id="admin-overview-season">Wird geladen…</strong><small>Aktueller Saisonstatus</small></article>
          <article class="rcc-admin-home__status-card"><span>Rennkalender</span><strong id="admin-overview-races">Wird geladen…</strong><small>Rennen der aktiven Saison</small></article>
          <article class="rcc-admin-home__status-card"><span>Ergebnis-Workflow</span><strong id="admin-overview-imports">Wird geladen…</strong><small id="admin-overview-imports-sub">Offene Entwürfe werden geprüft</small></article>
          <article class="rcc-admin-home__status-card"><span>Zugang</span><strong id="admin-overview-session">Wird geladen…</strong><small id="admin-overview-session-sub">Session wird geprüft</small></article>
        </div>

        <div class="rcc-admin-home__action-grid">
          <article class="rcc-results-workflow__card rcc-admin-home__action-card">
            <div class="rcc-results-workflow__icon" aria-hidden="true">▣</div><div><h4>Ergebnis eintragen</h4><p>KI-Bildimport, manuelle Eingabe oder offene Ergebnisentwürfe aufrufen.</p></div>
            <button type="button" class="button-primary" data-rcc-admin-home-action="results">Ergebnisse öffnen</button>
          </article>
          <article class="rcc-results-workflow__card rcc-admin-home__action-card">
            <div class="rcc-results-workflow__icon" aria-hidden="true">🏁</div><div><h4>Rennen verwalten</h4><p>Rennen anlegen, verschieben, entfernen oder den Rennkalender bearbeiten.</p></div>
            <button type="button" class="button-primary" data-rcc-admin-home-action="calendar">Rennen öffnen</button>
          </article>
          <article class="rcc-results-workflow__card rcc-admin-home__action-card">
            <div class="rcc-results-workflow__icon" aria-hidden="true">F</div><div><h4>Fahrer & Teams</h4><p>Fahrer, Gamertags, KI-Zuordnungen und Teamdaten pflegen.</p></div>
            <button type="button" class="button-primary" data-rcc-admin-home-action="drivers">Fahrer öffnen</button>
          </article>
          <article class="rcc-results-workflow__card rcc-admin-home__action-card">
            <div class="rcc-results-workflow__icon" aria-hidden="true">⚑</div><div><h4>Steward-Fall</h4><p>Einen neuen Vorfall erfassen und direkt zur Steward-Entscheidung gehen.</p></div>
            <button type="button" class="button-primary" data-rcc-admin-home-action="steward">Fall anlegen</button>
          </article>
          <article class="rcc-results-workflow__card rcc-admin-home__action-card">
            <div class="rcc-results-workflow__icon" aria-hidden="true">S</div><div><h4>Saison verwalten</h4><p>Season-Status prüfen, neue Season einrichten oder die laufende Season abschließen.</p></div>
            <button type="button" class="button-primary" data-rcc-admin-home-action="season">Saison öffnen</button>
          </article>
          <article class="rcc-results-workflow__card rcc-admin-home__action-card">
            <div class="rcc-results-workflow__icon" aria-hidden="true">◈</div><div><h4>Branding bearbeiten</h4><p>Logo, Liganame, Links und das geprüfte RCC-Farbschema jederzeit anpassen.</p></div>
            <button type="button" class="button-primary" data-rcc-admin-home-action="branding">Branding öffnen</button>
          </article>
        </div>

        <div class="rcc-admin-home__secondary-actions"><button type="button" class="button-secondary" data-rcc-admin-home-action="rules">Regeln & Inhalte</button></div>
      </section>`;
  }

  function createHomeSection() {
    const section = document.createElement('details');
    section.id = HOME_SECTION_ID;
    section.className = 'panel rcc-admin-home-section';
    section.hidden = true;
    section.open = true;
    section.innerHTML = homeMarkup();
    return section;
  }

  function ensureStructure() {
    const tabs = document.getElementById('admin-mobile-tabs');
    const layout = document.querySelector('.admin-layout');
    if (!tabs || !layout) return false;
    let homeButton = tabs.querySelector(`[data-admin-tab-target="${HOME_SECTION_ID}"]`);
    if (!homeButton) {
      homeButton = document.createElement('button');
      homeButton.type = 'button';
      homeButton.className = 'admin-mobile-tab';
      homeButton.dataset.adminTabTarget = HOME_SECTION_ID;
      homeButton.setAttribute('role', 'tab');
      homeButton.setAttribute('aria-selected', 'false');
      homeButton.textContent = HOME_TAB_LABEL;
      tabs.prepend(homeButton);
    }
    let section = document.getElementById(HOME_SECTION_ID);
    if (!section) {
      section = createHomeSection();
      const authPanel = document.getElementById('admin-section-auth');
      if (authPanel?.parentNode === layout) authPanel.after(section);
      else layout.prepend(section);
    } else if (!section.querySelector('[data-rcc-admin-home-ready="true"]')) {
      section.classList.add('rcc-admin-home-section');
      section.open = true;
      section.innerHTML = homeMarkup();
    }
    return true;
  }

  function tabButton(targetId) { return document.querySelector(`#admin-mobile-tabs [data-admin-tab-target="${targetId}"]`); }
  function selectTab(targetId) { const button = tabButton(targetId); if (!button) return false; button.click(); return true; }
  function openHome() { return selectTab(HOME_SECTION_ID); }

  function openHubCard(sectionId, titlePattern) {
    selectTab(sectionId);
    const section = document.getElementById(sectionId);
    if (!section) return;
    const tryOpen = () => {
      const cards = [...section.querySelectorAll('.rcc-admin-section-hub .rcc-results-workflow__card')];
      const card = cards.find((item) => titlePattern.test(String(item.querySelector('h4')?.textContent || '')));
      const button = card?.querySelector('button');
      if (!button) return false;
      button.click();
      return true;
    };
    if (tryOpen()) return;
    const observer = new MutationObserver(() => {
      if (!tryOpen()) return;
      observer.disconnect();
      window.clearTimeout(timeoutId);
    });
    observer.observe(section, { childList: true, subtree: true });
    const timeoutId = window.setTimeout(() => observer.disconnect(), 2500);
  }

  function openBranding() {
    if (window.RCCAdminBranding?.open) {
      window.RCCAdminBranding.open();
      return;
    }
    if (!document.querySelector('script[data-rcc-admin-branding="true"]')) {
      const script = document.createElement('script');
      script.src = 'assets/js/pages/admin-branding.js';
      script.dataset.rccAdminBranding = 'true';
      script.onload = async () => {
        await window.RCCAdminBranding?.init?.();
        window.RCCAdminBranding?.open?.();
      };
      document.head.appendChild(script);
      return;
    }
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (window.RCCAdminBranding?.open) {
        window.clearInterval(timer);
        window.RCCAdminBranding.open();
      } else if (attempts >= 25) window.clearInterval(timer);
    }, 80);
  }

  function runAction(action) {
    switch (action) {
      case 'results': selectTab('admin-section-results'); break;
      case 'calendar': selectTab('admin-section-calendar'); break;
      case 'drivers': selectTab('admin-section-drivers'); break;
      case 'steward': openHubCard('admin-section-stewarding', /steward.*anlegen|steward-eintrag/i); break;
      case 'season': openHubCard('admin-section-calendar', /saisonverwaltung/i); break;
      case 'branding': openBranding(); break;
      case 'rules': selectTab('admin-section-rules'); break;
      default: break;
    }
  }

  function bindActions() {
    const section = document.getElementById(HOME_SECTION_ID);
    if (!section || section.dataset.rccAdminHomeBound === 'true') return;
    section.addEventListener('click', (event) => {
      const button = event.target.closest('[data-rcc-admin-home-action]');
      if (!button) return;
      runAction(button.dataset.rccAdminHomeAction || '');
    });
    section.dataset.rccAdminHomeBound = 'true';
  }

  function wrapAdminInit() {
    if (window.initAdminPage?.__rccAdminHomeWrapped || typeof window.initAdminPage !== 'function') return;
    originalInitAdminPage = window.initAdminPage;
    const wrapped = function (...args) {
      const result = originalInitAdminPage.apply(this, args);
      queueMicrotask(() => openHome());
      return result;
    };
    wrapped.__rccAdminHomeWrapped = true;
    window.initAdminPage = wrapped;
  }

  function refreshOverview() {
    if (typeof window.updateAdminOverview !== 'function') return;
    Promise.resolve(window.updateAdminOverview()).catch(() => undefined);
  }

  function init() {
    ensureStylesheet();
    if (!ensureStructure()) return false;
    bindActions();
    wrapAdminInit();
    refreshOverview();
    initialized = true;
    return true;
  }

  window.RCCAdminHome = { init, openHome, runAction };
  init();
})();
