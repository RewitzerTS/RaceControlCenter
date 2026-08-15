(() => {
  if (window.RCCResultsWorkflow) return;

  let manualModulePromise = null;
  let aiModulePromise = null;
  let fileImportPanel = null;

  function ensureStylesheet() {
    if (document.querySelector('link[data-rcc-results-workflow="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-results-workflow.css';
    link.dataset.rccResultsWorkflow = 'true';
    document.head.appendChild(link);
  }

  function loadScriptModule(globalName, src, errorMessage, promiseGetter, promiseSetter) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    const pending = promiseGetter();
    if (pending) return pending;

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
    }).finally(() => promiseSetter(null));

    promiseSetter(promise);
    return promise;
  }

  function loadManualModule() {
    return loadScriptModule(
      'RCCManualResultsEntry',
      'assets/js/components/rcc-manual-results-entry.js',
      'Manuelle Ergebniseingabe konnte nicht geladen werden.',
      () => manualModulePromise,
      (value) => { manualModulePromise = value; }
    );
  }

  function loadAiModule() {
    return loadScriptModule(
      'RCCAIResultsImport',
      'assets/js/components/rcc-ai-results-import.js',
      'KI-Bildimport konnte nicht geladen werden.',
      () => aiModulePromise,
      (value) => { aiModulePromise = value; }
    );
  }

  function getPanels(root) {
    const section = root.querySelector?.('#admin-section-results');
    if (!section) return null;
    const panels = [...section.children].filter((node) => node.tagName === 'DETAILS');
    return {
      section,
      csvPanel: panels.find((panel) => panel.querySelector('#csv-file')) || null,
      publishPanel: panels.find((panel) => panel.querySelector('#publish-workflow-list')) || null,
      manualPanel: panels.find((panel) => panel.querySelector('#manual-results-panel')) || null
    };
  }

  function openPanel(panel, title) {
    if (!panel || !window.RCCWizardDialog?.open) return false;
    panel.classList.add('rcc-results-workflow-panel');
    return window.RCCWizardDialog.open(panel, {
      title,
      headerActionLabel: 'Schließen',
      onHeaderAction: () => window.RCCWizardDialog.close?.()
    });
  }

  function setImportHubFeedback(message = '', isError = false) {
    const feedback = fileImportPanel?.querySelector('#rcc-file-import-feedback');
    if (!feedback) return;
    feedback.hidden = !message;
    feedback.textContent = message;
    feedback.classList.toggle('notice-error', Boolean(isError));
  }

  async function openAiImport() {
    try {
      setImportHubFeedback('');
      const module = await loadAiModule();
      await module?.open?.();
    } catch (error) {
      console.error(error);
      setImportHubFeedback(error.message || 'KI-Bildimport konnte nicht geöffnet werden.', true);
    }
  }

  function ensureFileImportPanel(csvPanel) {
    if (fileImportPanel) return fileImportPanel;

    fileImportPanel = document.createElement('section');
    fileImportPanel.id = 'rcc-file-import-panel';
    fileImportPanel.className = 'panel admin-panel-wide admin-panel-accent rcc-results-workflow-panel';
    fileImportPanel.innerHTML = `
      <div class="rcc-file-import-choice">
        <div class="notice">
          Wähle, wie du das Rennergebnis importieren möchtest. Beide Wege erzeugen zunächst einen Entwurf, der vor der Veröffentlichung geprüft werden kann.
        </div>
        <div class="rcc-file-import-choice__grid section-spacer-top">
          <article class="rcc-results-workflow__card rcc-file-import-choice__card">
            <div class="rcc-results-workflow__icon" aria-hidden="true">▣</div>
            <div>
              <h4>KI-Bilder</h4>
              <p>Bis zu 8 Screenshots des Rennergebnisses hochladen. Die KI liest Positionen, Fahrer, Startplätze, Stopps und Zeiten aus und zeigt alles anschließend als bearbeitbare Tabelle.</p>
            </div>
            <button type="button" class="button-primary" data-rcc-file-import="ai">Bilder auslesen</button>
          </article>
          <article class="rcc-results-workflow__card rcc-file-import-choice__card">
            <div class="rcc-results-workflow__icon" aria-hidden="true">CSV</div>
            <div>
              <h4>CSV-Datei</h4>
              <p>Eine vorhandene Ergebnis-CSV hochladen, das Fahrer-Mapping prüfen und den Import als Entwurf übernehmen.</p>
            </div>
            <button type="button" class="button-primary" data-rcc-file-import="csv">CSV hochladen</button>
          </article>
        </div>
        <div id="rcc-file-import-feedback" class="notice notice-error section-spacer-top" hidden></div>
      </div>`;

    fileImportPanel.querySelector('[data-rcc-file-import="ai"]')?.addEventListener('click', openAiImport);
    fileImportPanel.querySelector('[data-rcc-file-import="csv"]')?.addEventListener('click', () => {
      setImportHubFeedback('');
      openPanel(csvPanel, 'CSV-Datei importieren');
    });

    return fileImportPanel;
  }

  function openFileImport(csvPanel) {
    const panel = ensureFileImportPanel(csvPanel);
    openPanel(panel, 'Datei importieren');
  }

  async function openManualEntry(manualPanel) {
    try {
      const manualModule = await loadManualModule();
      manualModule?.mount?.(manualPanel);
      openPanel(manualPanel, 'Ergebnis manuell eingeben');
    } catch (error) {
      console.error(error);
      openPanel(manualPanel, 'Ergebnis manuell eingeben');
    }
  }

  function ensureLauncher(root = document) {
    const found = getPanels(root);
    if (!found) return false;
    const { section, csvPanel, publishPanel, manualPanel } = found;
    if (!csvPanel || !publishPanel || !manualPanel) return false;
    if (section.querySelector('#admin-results-workflow-launcher')) return true;

    [csvPanel, publishPanel, manualPanel].forEach((panel) => {
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
          <p class="muted">Importiere Ergebnisbilder per KI oder eine CSV-Datei – oder erfasse das Rennen vollständig manuell. Erst die spätere Freigabe veröffentlicht das Ergebnis.</p>
        </div>
      </div>
      <div class="rcc-results-workflow__grid">
        <article class="rcc-results-workflow__card">
          <div class="rcc-results-workflow__icon" aria-hidden="true">↥</div>
          <div>
            <h4>Datei importieren</h4>
            <p>KI-Bilder auslesen oder eine CSV-Datei hochladen. Die importierten Werte können vor der Freigabe kontrolliert werden.</p>
          </div>
          <button type="button" class="button-primary" data-rcc-results-action="import">Datei importieren</button>
        </article>
        <article class="rcc-results-workflow__card">
          <div class="rcc-results-workflow__icon" aria-hidden="true">✎</div>
          <div>
            <h4>Manuelle Eingabe</h4>
            <p>Zuerst ein Rennen auswählen. Danach öffnet sich eine leere Tabelle für Positionen, Fahrer, Grid, Stopps und Renn- sowie Rundenzeiten.</p>
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

    launcher.querySelector('[data-rcc-results-action="import"]')?.addEventListener('click', () => openFileImport(csvPanel));
    launcher.querySelector('[data-rcc-results-action="manual"]')?.addEventListener('click', () => openManualEntry(manualPanel));
    launcher.querySelector('[data-rcc-results-action="publish"]')?.addEventListener('click', () => openPanel(publishPanel, 'Entwürfe & Freigabe'));
    return true;
  }

  ensureStylesheet();
  window.RCCResultsWorkflow = { ensureLauncher, openFileImport };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureLauncher(), { once: true });
  } else {
    ensureLauncher();
  }
})();
