(() => {
  if (window.RCCResultsWorkflow) return;

  function ensureStylesheet() {
    if (document.querySelector('link[data-rcc-results-workflow="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-results-workflow.css';
    link.dataset.rccResultsWorkflow = 'true';
    document.head.appendChild(link);
  }

  function getPanels(root) {
    const section = root.querySelector?.('#admin-section-results');
    if (!section) return null;
    const panels = [...section.children].filter((node) => node.tagName === 'DETAILS');
    return {
      section,
      importPanel: panels.find((panel) => panel.querySelector('#csv-file')) || null,
      publishPanel: panels.find((panel) => panel.querySelector('#publish-workflow-list')) || null,
      manualPanel: panels.find((panel) => panel.querySelector('#manual-results-panel')) || null
    };
  }

  function openPanel(panel, title) {
    if (!panel || !window.RCCWizardDialog?.open) return;
    panel.classList.add('rcc-results-workflow-panel');
    window.RCCWizardDialog.open(panel, {
      title,
      headerActionLabel: 'Schließen',
      onHeaderAction: () => window.RCCWizardDialog.close?.()
    });
  }

  function ensureLauncher(root = document) {
    const found = getPanels(root);
    if (!found) return false;
    const { section, importPanel, publishPanel, manualPanel } = found;
    if (!importPanel || !publishPanel || !manualPanel) return false;
    if (section.querySelector('#admin-results-workflow-launcher')) return true;

    [importPanel, publishPanel, manualPanel].forEach((panel) => {
      panel.hidden = true;
    });

    const launcher = document.createElement('section');
    launcher.id = 'admin-results-workflow-launcher';
    launcher.className = 'rcc-results-workflow';
    launcher.innerHTML = `
      <div class="rcc-results-workflow__intro">
        <div>
          <span class="eyebrow">Rennergebnis</span>
          <h3>Wie möchtest du das Ergebnis erfassen?</h3>
          <p class="muted">Wähle nur den Arbeitsschritt, den du gerade brauchst. Entwürfe bleiben getrennt von der späteren Freigabe.</p>
        </div>
      </div>
      <div class="rcc-results-workflow__grid">
        <article class="rcc-results-workflow__card">
          <div class="rcc-results-workflow__icon" aria-hidden="true">↥</div>
          <div>
            <h4>Datei-Import</h4>
            <p>Ergebnisdatei laden, Mapping prüfen und den Import zunächst als Entwurf übernehmen.</p>
          </div>
          <button type="button" class="button-primary" data-rcc-results-action="import">Import öffnen</button>
        </article>
        <article class="rcc-results-workflow__card">
          <div class="rcc-results-workflow__icon" aria-hidden="true">✎</div>
          <div>
            <h4>Manuelle Eingabe</h4>
            <p>Ein Rennen auswählen und die Ergebniswerte direkt in der Tabelle erfassen oder korrigieren.</p>
          </div>
          <button type="button" class="button-primary" data-rcc-results-action="manual">Manuell eingeben</button>
        </article>
        <article class="rcc-results-workflow__card rcc-results-workflow__card--secondary">
          <div class="rcc-results-workflow__icon" aria-hidden="true">✓</div>
          <div>
            <h4>Entwürfe & Freigabe</h4>
            <p>Zwischengespeicherte Rennergebnisse prüfen und nach den Steward-Entscheidungen final veröffentlichen.</p>
          </div>
          <button type="button" class="button-secondary" data-rcc-results-action="publish">Freigabe öffnen</button>
        </article>
      </div>`;

    const summary = [...section.children].find((node) => node.tagName === 'SUMMARY');
    if (summary?.nextSibling) section.insertBefore(launcher, summary.nextSibling);
    else section.appendChild(launcher);

    launcher.querySelector('[data-rcc-results-action="import"]')?.addEventListener('click', () => openPanel(importPanel, 'Ergebnis importieren'));
    launcher.querySelector('[data-rcc-results-action="manual"]')?.addEventListener('click', () => openPanel(manualPanel, 'Ergebnis manuell eingeben'));
    launcher.querySelector('[data-rcc-results-action="publish"]')?.addEventListener('click', () => openPanel(publishPanel, 'Entwürfe & Freigabe'));
    return true;
  }

  ensureStylesheet();
  window.RCCResultsWorkflow = { ensureLauncher };
})();
