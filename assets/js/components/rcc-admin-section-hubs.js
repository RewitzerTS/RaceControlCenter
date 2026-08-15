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
    return Object.keys(SECTION_CONFIG).map(ensureSectionHub).every(Boolean);
  }

  window.RCCAdminSectionHubs = { ensureAll, ensureSectionHub };
})();
