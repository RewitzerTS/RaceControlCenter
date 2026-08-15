(() => {
  if (window.RCCAdminSectionHubs) return;

  const SECTION_CONFIG = {
    'admin-section-calendar': {
      eyebrow: 'Saison & Kalender',
      title: 'Was möchtest du am Rennbetrieb verwalten?',
      description: 'Öffne nur den Bereich, den du gerade brauchst. Season, Rennkalender und einzelne Renntage bleiben getrennt und übersichtlich.'
    },
    'admin-section-stewarding': {
      eyebrow: 'Rennleitung',
      title: 'Was möchtest du im Stewarding bearbeiten?',
      description: 'Lege neue Steward-Fälle an oder öffne bestehende Entscheidungen zur weiteren Bearbeitung.'
    },
    'admin-section-drivers': {
      eyebrow: 'Fahrer & Teams',
      title: 'Fahrer verwalten',
      description: 'Pflege Fahrer, Gamertags, AI-Zuordnungen und Teamdaten zentral in einem geführten Arbeitsbereich.'
    },
    'admin-section-rules': {
      eyebrow: 'Regelwerk',
      title: 'Liga-Regeln verwalten',
      description: 'Öffne das Regelwerk und passe die öffentlichen Renn- und Ligaeinstellungen an.'
    }
  };

  const PANEL_META = [
    {
      match: /saisonverwaltung/i,
      icon: 'S',
      description: 'Aktive Season prüfen, eine neue Season über den Wizard einrichten oder die laufende Season abschließen.'
    },
    {
      match: /rennen anlegen/i,
      icon: '+',
      description: 'Ein einzelnes Rennen mit Strecke, Termin, Wetter und Status zum Rennkalender hinzufügen.'
    },
    {
      match: /renntag verschieben/i,
      icon: '↔',
      description: 'Einen Renntag neu terminieren und auf Wunsch die folgenden Rennen gemeinsam verschieben.'
    },
    {
      match: /rennen entfernen/i,
      icon: '−',
      description: 'Ein Rennen kontrolliert aus dem aktuellen Rennkalender entfernen.'
    },
    {
      match: /steward.*anlegen|steward-eintrag/i,
      icon: '⚑',
      description: 'Vorfall, beteiligte Fahrer, Entscheidung und Konsequenz für einen Steward-Fall erfassen.'
    },
    {
      match: /steward|entscheidungen|fälle/i,
      icon: '✓',
      description: 'Bestehende Steward-Fälle und Entscheidungen prüfen, bearbeiten oder entfernen.'
    },
    {
      match: /fahrer/i,
      icon: 'F',
      description: 'Fahrer-Stammdaten, Gamertags, AI-Fahrer und Teamzuordnungen pflegen sowie bestehende Fahrer bearbeiten.'
    },
    {
      match: /regeln/i,
      icon: '§',
      description: 'Öffentliche Liga-Regeln, Rennparameter und weitere Vorgaben zentral bearbeiten.'
    }
  ];

  let driverEditorWrapper = null;
  let driverEditorHome = null;
  let driverListObserver = null;

  function ensureDriverCardStyles() {
    if (document.getElementById('rcc-driver-card-dialog-style')) return;
    const style = document.createElement('style');
    style.id = 'rcc-driver-card-dialog-style';
    style.textContent = `
      .compact-driver-actions.rcc-driver-card-actions {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        align-items: stretch;
      }
      .compact-driver-actions.rcc-driver-card-actions > button {
        width: 100%;
        min-width: 0;
        min-height: 44px;
        height: 100%;
        margin: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        white-space: normal;
      }
      .driver-swap-dialog,
      .rcc-driver-edit-dialog {
        width: min(680px, calc(100vw - 28px));
        max-height: min(86vh, 760px);
        overflow: auto;
      }
      .rcc-driver-edit-dialog__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .rcc-driver-edit-dialog__header h3 {
        margin: 0;
      }
      .rcc-driver-edit-dialog__close {
        flex: 0 0 auto;
      }
      .rcc-driver-edit-dialog #driver-feedback {
        margin-top: 12px;
      }
      @media (max-width: 720px) {
        .compact-driver-actions.rcc-driver-card-actions {
          grid-template-columns: 1fr;
        }
        .compact-driver-actions.rcc-driver-card-actions > button {
          min-height: 46px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeDriverCardButtons(root = document) {
    const list = root.querySelector?.('#driver-list') || document.getElementById('driver-list');
    if (!list) return false;
    list.querySelectorAll('.compact-driver-actions').forEach((actions) => {
      actions.classList.add('rcc-driver-card-actions');
      actions.querySelectorAll('button').forEach((button) => {
        button.classList.add('button-secondary');
      });
    });
    return true;
  }

  function observeDriverCards() {
    const list = document.getElementById('driver-list');
    if (!list) return false;
    normalizeDriverCardButtons();
    if (driverListObserver) return true;
    driverListObserver = new MutationObserver(() => normalizeDriverCardButtons());
    driverListObserver.observe(list, { childList: true, subtree: true });
    return true;
  }

  function ensureDriverEditorWrapper() {
    if (driverEditorWrapper?.isConnected) return driverEditorWrapper;

    const displayName = document.getElementById('driver-display-name');
    const sourcePanel = displayName?.closest('section.panel');
    const hiddenId = document.getElementById('driver-id');
    const formGrid = displayName?.closest('.form-grid');
    const saveButton = document.getElementById('save-driver-btn');
    const actions = saveButton?.closest('.card-actions');
    const feedback = document.getElementById('driver-feedback');
    const listBlock = document.getElementById('driver-list')?.parentElement;

    if (!sourcePanel || !hiddenId || !formGrid || !actions || !feedback || !listBlock) return null;

    driverEditorHome = sourcePanel;
    driverEditorWrapper = document.createElement('div');
    driverEditorWrapper.id = 'rcc-driver-editor-fields';
    driverEditorWrapper.className = 'rcc-driver-editor-fields';
    sourcePanel.insertBefore(driverEditorWrapper, hiddenId);
    [hiddenId, formGrid, actions, feedback].forEach((node) => driverEditorWrapper.appendChild(node));
    return driverEditorWrapper;
  }

  function restoreDriverEditor() {
    const wrapper = driverEditorWrapper;
    const home = driverEditorHome;
    if (!wrapper || !home) return;
    const listBlock = document.getElementById('driver-list')?.parentElement;
    if (listBlock?.parentNode === home) home.insertBefore(wrapper, listBlock);
    else home.appendChild(wrapper);
  }

  function ensureDriverEditModal() {
    let modal = document.getElementById('rcc-driver-edit-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'rcc-driver-edit-modal';
    modal.className = 'trackmap-lightbox hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="trackmap-lightbox-backdrop" data-rcc-driver-edit-backdrop></div>
      <div class="trackmap-lightbox-dialog rcc-driver-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="rcc-driver-edit-title">
        <div class="rcc-driver-edit-dialog__header">
          <div>
            <div class="eyebrow">Fahrer-Stammdaten</div>
            <h3 id="rcc-driver-edit-title" class="trackmap-lightbox-title">Fahrer bearbeiten</h3>
          </div>
          <button type="button" class="button-secondary rcc-driver-edit-dialog__close" data-rcc-driver-edit-close>Schließen</button>
        </div>
        <div data-rcc-driver-edit-host></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-rcc-driver-edit-close]')?.addEventListener('click', closeDriverEditModal);
    modal.querySelector('[data-rcc-driver-edit-backdrop]')?.addEventListener('click', closeDriverEditModal);
    return modal;
  }

  function closeDriverEditModal() {
    const modal = document.getElementById('rcc-driver-edit-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    restoreDriverEditor();
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function populateDriverEditorFromButton(button) {
    if (typeof window.editDriver === 'function') {
      window.editDriver(
        button.dataset.id || '',
        button.dataset.displayName || '',
        button.dataset.aiDriverReference || '',
        button.dataset.gamertag || '',
        button.dataset.leagueTeam || '',
        button.dataset.carName || ''
      );
      return;
    }

    const values = {
      'driver-id': button.dataset.id || '',
      'driver-display-name': button.dataset.displayName || '',
      'driver-ai-reference': button.dataset.aiDriverReference || '',
      'driver-gamertag': button.dataset.gamertag || '',
      'driver-league-team': button.dataset.leagueTeam || '',
      'driver-car-name': button.dataset.carName || ''
    };
    Object.entries(values).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.value = value;
    });
  }

  function openDriverEditModal(button) {
    const wrapper = ensureDriverEditorWrapper();
    const modal = ensureDriverEditModal();
    const host = modal.querySelector('[data-rcc-driver-edit-host]');
    if (!wrapper || !host) return false;

    populateDriverEditorFromButton(button);
    host.replaceChildren(wrapper);
    const title = modal.querySelector('#rcc-driver-edit-title');
    if (title) title.textContent = `Fahrer bearbeiten · ${button.dataset.displayName || 'Fahrer'}`;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => {
      document.getElementById('driver-display-name')?.focus?.({ preventScroll: true });
    });
    return true;
  }

  function bindDriverCardDialogs() {
    if (document.documentElement.dataset.rccDriverCardDialogsBound === 'true') return true;

    document.addEventListener('click', (event) => {
      const editButton = event.target.closest('.edit-driver-btn');
      if (!editButton) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openDriverEditModal(editButton);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const modal = document.getElementById('rcc-driver-edit-modal');
      if (modal && !modal.classList.contains('hidden')) closeDriverEditModal();
    });

    document.documentElement.dataset.rccDriverCardDialogsBound = 'true';
    return true;
  }

  function getPanelTitle(panel) {
    if (!panel) return 'Bereich';
    if (panel.tagName === 'DETAILS') {
      const summary = [...panel.children].find((node) => node.tagName === 'SUMMARY');
      const text = String(summary?.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    const heading = panel.querySelector?.(':scope > h2, :scope > h3, :scope > h4')
      || panel.querySelector?.('h2, h3, h4');
    return String(heading?.textContent || 'Bereich').replace(/\s+/g, ' ').trim();
  }

  function getPanelMeta(title) {
    const entry = PANEL_META.find((item) => item.match.test(title));
    return entry || {
      icon: '›',
      description: 'Diesen Arbeitsbereich öffnen und die vorhandenen Einstellungen bearbeiten.'
    };
  }

  function collectWorkPanels(section) {
    const directDetails = [...section.children].filter((node) => node.tagName === 'DETAILS');
    const directSections = [...section.children].filter((node) => node.tagName === 'SECTION' && node.classList.contains('panel'));
    const panels = [...directDetails];

    directSections.forEach((wrapper) => {
      const nestedDetails = [...wrapper.children].filter((node) => node.tagName === 'DETAILS' && node.classList.contains('panel'));
      if (nestedDetails.length) panels.push(...nestedDetails);
      else panels.push(wrapper);
    });

    return panels.filter((panel, index, items) => items.indexOf(panel) === index && !panel.dataset.rccAdminHubIgnore);
  }

  function openPanel(panel, title) {
    if (!panel || !window.RCCWizardDialog?.open) return false;
    panel.classList.add('rcc-results-workflow-panel', 'rcc-admin-hub-dialog-panel');
    return window.RCCWizardDialog.open(panel, {
      title,
      headerActionLabel: 'Schließen',
      onHeaderAction: () => window.RCCWizardDialog.close?.()
    });
  }

  function buildCard(panel, index) {
    const title = getPanelTitle(panel);
    const meta = getPanelMeta(title);
    const card = document.createElement('article');
    card.className = `rcc-results-workflow__card${index > 1 ? ' rcc-results-workflow__card--secondary' : ''}`;
    card.innerHTML = `
      <div class="rcc-results-workflow__icon" aria-hidden="true">${meta.icon}</div>
      <div>
        <h4></h4>
        <p></p>
      </div>
      <button type="button" class="button-primary">Öffnen</button>`;
    card.querySelector('h4').textContent = title;
    card.querySelector('p').textContent = meta.description;
    card.querySelector('button')?.addEventListener('click', () => openPanel(panel, title));
    return card;
  }

  function bindDialogCloseOnTabChange() {
    const tabsRoot = document.getElementById('admin-mobile-tabs');
    if (!tabsRoot || tabsRoot.dataset.rccDialogCloseBound === 'true') return false;

    tabsRoot.addEventListener('click', (event) => {
      const nextButton = event.target.closest('[data-admin-tab-target]');
      if (!nextButton || !tabsRoot.contains(nextButton)) return;
      const currentButton = tabsRoot.querySelector('[data-admin-tab-target].is-active');
      if (currentButton && currentButton !== nextButton) {
        closeDriverEditModal();
        window.RCCWizardDialog?.close?.();
      }
    }, true);

    tabsRoot.dataset.rccDialogCloseBound = 'true';
    return true;
  }

  function ensureSectionHub(sectionId) {
    const config = SECTION_CONFIG[sectionId];
    const section = document.getElementById(sectionId);
    if (!config || !section) return false;
    if (section.querySelector(':scope > .rcc-admin-section-hub')) return true;

    const panels = collectWorkPanels(section);
    if (!panels.length) return false;

    panels.forEach((panel) => {
      panel.hidden = true;
    });

    const launcher = document.createElement('section');
    launcher.className = 'rcc-results-workflow rcc-admin-section-hub';
    launcher.dataset.adminHubFor = sectionId;
    launcher.innerHTML = `
      <div class="rcc-results-workflow__intro">
        <div>
          <span class="eyebrow"></span>
          <h3></h3>
          <p class="muted"></p>
        </div>
      </div>
      <div class="rcc-results-workflow__grid"></div>`;

    launcher.querySelector('.eyebrow').textContent = config.eyebrow;
    launcher.querySelector('h3').textContent = config.title;
    launcher.querySelector('.muted').textContent = config.description;
    const grid = launcher.querySelector('.rcc-results-workflow__grid');
    panels.forEach((panel, index) => grid?.appendChild(buildCard(panel, index)));

    const summary = [...section.children].find((node) => node.tagName === 'SUMMARY');
    if (summary?.nextSibling) section.insertBefore(launcher, summary.nextSibling);
    else section.appendChild(launcher);
    return true;
  }

  function ensureAll() {
    const ready = Object.keys(SECTION_CONFIG).map(ensureSectionHub).every(Boolean);
    ensureDriverCardStyles();
    observeDriverCards();
    bindDriverCardDialogs();
    bindDialogCloseOnTabChange();
    return ready;
  }

  window.RCCAdminSectionHubs = {
    ensureAll,
    ensureSectionHub,
    normalizeDriverCardButtons,
    openDriverEditModal,
    closeDriverEditModal
  };
})();
