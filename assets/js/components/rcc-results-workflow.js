(() => {
  if (window.RCCResultsWorkflow) return;

  let manualModulePromise = null;
  let aiModulePromise = null;
  let timeFormatModulePromise = null;
  let resultDraftModulePromise = null;
  let resultReleaseModulePromise = null;
  let resultReviewOverviewPromise = null;
  let resultReviewHardeningPromise = null;
  let resultPublishReceiptPromise = null;
  let adminSectionHubsPromise = null;
  let adminHomePromise = null;

  function ensureStylesheet() {
    if (document.querySelector('link[data-rcc-results-workflow="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-results-workflow.css';
    link.dataset.rccResultsWorkflow = 'true';
    document.head.appendChild(link);
  }

  function ensureAdminHomePlaceholder() {
    const tabs = document.getElementById('admin-mobile-tabs');
    const layout = document.querySelector('.admin-layout');
    if (!tabs || !layout) return false;

    let homeButton = tabs.querySelector('[data-admin-tab-target="admin-section-home"]');
    if (!homeButton) {
      homeButton = document.createElement('button');
      homeButton.type = 'button';
      homeButton.className = 'admin-mobile-tab';
      homeButton.dataset.adminTabTarget = 'admin-section-home';
      homeButton.setAttribute('role', 'tab');
      homeButton.setAttribute('aria-selected', 'false');
      homeButton.textContent = 'Übersicht';
      tabs.prepend(homeButton);
    }

    let homeSection = document.getElementById('admin-section-home');
    if (!homeSection) {
      homeSection = document.createElement('details');
      homeSection.id = 'admin-section-home';
      homeSection.className = 'panel rcc-admin-home-section';
      homeSection.hidden = true;
      homeSection.open = true;
      homeSection.innerHTML = `
        <summary><strong>Übersicht</strong></summary>
        <section class="rcc-results-workflow rcc-admin-home">
          <div class="notice">Admin-Übersicht wird vorbereitet…</div>
        </section>`;
      const authPanel = document.getElementById('admin-section-auth');
      if (authPanel?.parentNode === layout) authPanel.after(homeSection);
      else layout.prepend(homeSection);
    }

    if (typeof window.initAdminPage === 'function' && !window.initAdminPage.__rccAdminHomeWrapped) {
      const originalInit = window.initAdminPage;
      const wrappedInit = function (...args) {
        const result = originalInit.apply(this, args);
        queueMicrotask(() => {
          document.querySelector('#admin-mobile-tabs [data-admin-tab-target="admin-section-home"]')?.click();
        });
        return result;
      };
      wrappedInit.__rccAdminHomeWrapped = true;
      window.initAdminPage = wrappedInit;
    }
    return true;
  }

  function loadScriptModule(globalName, src, errorMessage, promiseGetter, promiseSetter) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    const pending = promiseGetter();
    if (pending) return pending;

    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-rcc-dynamic-src="${src}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(window[globalName]), { once: true });
        existing.addEventListener('error', () => reject(new Error(errorMessage)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.dataset.rccDynamicSrc = src;
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

  function loadTimeFormatModule() {
    return loadScriptModule(
      'RCCResultTimeFormat',
      'assets/js/components/rcc-result-time-format.js',
      'Zeitformat-Modul konnte nicht geladen werden.',
      () => timeFormatModulePromise,
      (value) => { timeFormatModulePromise = value; }
    );
  }

  function loadResultDraftModule() {
    return loadScriptModule(
      'RCCResultDraft',
      'assets/js/components/rcc-result-draft.js',
      'Entwurfs-Workflow konnte nicht geladen werden.',
      () => resultDraftModulePromise,
      (value) => { resultDraftModulePromise = value; }
    );
  }

  function loadResultReviewOverview() {
    return loadScriptModule(
      'RCCResultReviewOverview',
      'assets/js/components/rcc-result-review-overview.js',
      'Review Center konnte nicht geladen werden.',
      () => resultReviewOverviewPromise,
      (value) => { resultReviewOverviewPromise = value; }
    ).then((module) => {
      module?.init?.();
      return module;
    });
  }

  function loadResultReviewHardening() {
    return loadScriptModule(
      'RCCResultReviewHardening',
      'assets/js/components/rcc-result-review-hardening.js',
      'Review-Hardening konnte nicht geladen werden.',
      () => resultReviewHardeningPromise,
      (value) => { resultReviewHardeningPromise = value; }
    ).then((module) => {
      module?.init?.();
      return module;
    });
  }

  function loadResultPublishReceipt() {
    return loadScriptModule(
      'RCCResultPublishReceipt',
      'assets/js/components/rcc-result-publish-receipt.js',
      'Publish-Abschluss konnte nicht geladen werden.',
      () => resultPublishReceiptPromise,
      (value) => { resultPublishReceiptPromise = value; }
    ).then((module) => {
      module?.init?.();
      return module;
    });
  }

  function loadResultReleaseModule() {
    const NativeMutationObserver = window.MutationObserver;
    let guardInstalled = false;

    if (NativeMutationObserver && !window.RCCResultRelease) {
      window.MutationObserver = class RCCResultReleaseMutationObserver extends NativeMutationObserver {
        constructor(callback) {
          super((mutations, observer) => {
            const meaningfulMutations = mutations.filter((mutation) => {
              const target = mutation.target;
              return !(
                mutation.type === 'childList' &&
                target?.nodeType === 1 &&
                target.matches?.('.publish-results-btn')
              );
            });
            if (meaningfulMutations.length) callback(meaningfulMutations, observer);
          });
        }
      };
      guardInstalled = true;
    }

    return loadScriptModule(
      'RCCResultRelease',
      'assets/js/components/rcc-result-release.js',
      'Steward-/Freigabe-Workflow konnte nicht geladen werden.',
      () => resultReleaseModulePromise,
      (value) => { resultReleaseModulePromise = value; }
    ).finally(() => {
      if (guardInstalled && window.MutationObserver !== NativeMutationObserver) {
        window.MutationObserver = NativeMutationObserver;
      }
    }).then(async (module) => {
      module?.init?.();
      await loadResultReviewOverview().catch((error) => console.warn(error));
      await loadResultReviewHardening().catch((error) => console.warn(error));
      await loadResultPublishReceipt().catch((error) => console.warn(error));
      return module;
    });
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

  function loadAdminSectionHubs() {
    return loadScriptModule(
      'RCCAdminSectionHubs',
      'assets/js/components/rcc-admin-section-hubs.js',
      'Admin-Bereichsnavigation konnte nicht geladen werden.',
      () => adminSectionHubsPromise,
      (value) => { adminSectionHubsPromise = value; }
    ).then((module) => {
      module?.ensureAll?.();
      return module;
    });
  }

  function loadAdminHome() {
    ensureAdminHomePlaceholder();
    return loadScriptModule(
      'RCCAdminHome',
      'assets/js/components/rcc-admin-home.js',
      'Admin-Übersicht konnte nicht geladen werden.',
      () => adminHomePromise,
      (value) => { adminHomePromise = value; }
    ).then((module) => {
      module?.init?.();
      return module;
    });
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

  async function prepareResultEntryModules() {
    await Promise.all([loadTimeFormatModule(), loadResultDraftModule()]);
  }

  async function openAiImport() {
    try {
      await prepareResultEntryModules();
      const module = await loadAiModule();
      await module?.open?.();
    } catch (error) {
      console.error(error);
      window.alert?.(error.message || 'Dateiimport konnte nicht geöffnet werden.');
    }
  }

  function openCsvImport(csvPanel) {
    return openPanel(csvPanel, 'CSV importieren');
  }

  async function openManualEntry(manualPanel) {
    try {
      await prepareResultEntryModules();
      const manualModule = await loadManualModule();
      manualModule?.mount?.(manualPanel);
      openPanel(manualPanel, 'Ergebnis manuell eingeben');
    } catch (error) {
      console.error(error);
      openPanel(manualPanel, 'Ergebnis manuell eingeben');
    }
  }

  function ensureLauncher(root = document) {
    ensureAdminHomePlaceholder();
    const found = getPanels(root);
    if (!found) return false;
    const { section, csvPanel, publishPanel, manualPanel } = found;
    if (!csvPanel || !publishPanel || !manualPanel) return false;
    if (section.querySelector('#admin-results-workflow-launcher')) {
      loadAdminSectionHubs().catch((error) => console.warn(error));
      loadAdminHome().catch((error) => console.warn(error));
      loadResultReleaseModule().catch((error) => console.warn(error));
      return true;
    }

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
          <p class="muted">Wähle den passenden Erfassungsweg. Dateiimport, CSV und manuelle Eingabe bleiben getrennt und führen anschließend in den gemeinsamen Entwurfs- und Freigabeprozess.</p>
        </div>
      </div>
      <div class="rcc-results-workflow__grid">
        <article class="rcc-results-workflow__card">
          <div class="rcc-results-workflow__icon" aria-hidden="true">▣</div>
          <div>
            <h4>Datei importieren</h4>
            <p>Renn-Screenshots oder Ergebnisbilder hochladen und von der KI auslesen lassen. Die erkannten Werte können vor dem Speichern vollständig geprüft und bearbeitet werden.</p>
          </div>
          <button type="button" class="button-primary" data-rcc-results-action="ai">Bilder mit KI importieren</button>
        </article>
        <article class="rcc-results-workflow__card">
          <div class="rcc-results-workflow__icon" aria-hidden="true">CSV</div>
          <div>
            <h4>CSV importieren</h4>
            <p>Ein vorbereitetes Rennergebnis als CSV-Datei hochladen. Mapping und Konflikte werden vor dem Import angezeigt.</p>
          </div>
          <button type="button" class="button-primary" data-rcc-results-action="csv">CSV-Datei auswählen</button>
        </article>
        <article class="rcc-results-workflow__card">
          <div class="rcc-results-workflow__icon" aria-hidden="true">✎</div>
          <div>
            <h4>Manuelle Eingabe</h4>
            <p>Zuerst ein Rennen auswählen. Danach öffnet sich eine leere Tabelle für Position, Fahrer, Team, Startplatz, Stopps und Zeiten.</p>
          </div>
          <button type="button" class="button-primary" data-rcc-results-action="manual">Manuell eingeben</button>
        </article>
        <article class="rcc-results-workflow__card rcc-results-workflow__card--secondary">
          <div class="rcc-results-workflow__icon" aria-hidden="true"><svg class="rcc-icon--check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6"/></svg></div>
          <div>
            <h4>Entwürfe & Freigabe</h4>
            <p>Zwischengespeicherte Rennergebnisse aus allen Erfassungswegen prüfen und nach den Steward-Entscheidungen final veröffentlichen.</p>
          </div>
          <button type="button" class="button-primary" data-rcc-results-action="publish">Freigabe öffnen</button>
        </article>
      </div>`;

    const summary = [...section.children].find((node) => node.tagName === 'SUMMARY');
    if (summary?.nextSibling) section.insertBefore(launcher, summary.nextSibling);
    else section.appendChild(launcher);

    launcher.querySelector('[data-rcc-results-action="ai"]')?.addEventListener('click', openAiImport);
    launcher.querySelector('[data-rcc-results-action="csv"]')?.addEventListener('click', () => openCsvImport(csvPanel));
    launcher.querySelector('[data-rcc-results-action="manual"]')?.addEventListener('click', () => openManualEntry(manualPanel));
    launcher.querySelector('[data-rcc-results-action="publish"]')?.addEventListener('click', () => openPanel(publishPanel, 'Entwürfe & Freigabe'));
    loadAdminSectionHubs().catch((error) => console.warn(error));
    loadAdminHome().catch((error) => console.warn(error));
    loadResultReleaseModule().catch((error) => console.warn(error));
    return true;
  }

  ensureStylesheet();
  ensureAdminHomePlaceholder();
  prepareResultEntryModules().catch((error) => console.warn(error));
  loadResultReleaseModule().catch((error) => console.warn(error));
  window.RCCResultsWorkflow = { ensureLauncher, openAiImport, openCsvImport };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureLauncher(), { once: true });
  } else {
    ensureLauncher();
  }
})();
