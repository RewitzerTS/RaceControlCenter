const RCC_STORAGE_KEYS = {
  schedule: 'rcc_schedule',
  stewardNotes: 'rcc_stewards_notes',
  importedCsv: 'rcc_imported_results',
  splashSeen: 'rcc_splash_seen'
};

function isStandaloneMode() {
  const standaloneMedia = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = window.navigator.standalone === true;
  return standaloneMedia || iosStandalone;
}

function isMobileDevice() {
  return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
}

function initGlobalScrollProgress() {
  if (document.body?.dataset.scrollProgressBound === 'true') return;
  document.body.dataset.scrollProgressBound = 'true';

  let progressBar = document.querySelector('.site-scroll-progress');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.className = 'site-scroll-progress';
    progressBar.setAttribute('aria-hidden', 'true');
    document.body.prepend(progressBar);
  }

  const root = document.documentElement;

  const updateHeaderOffset = () => {
    const siteHeader = document.querySelector('.site-header');
    const headerBottom = siteHeader ? Math.max(siteHeader.getBoundingClientRect().bottom, 0) : 0;
    root.style.setProperty('--site-header-offset', `${Math.round(headerBottom)}px`);

    const viewportOffsetTop = window.visualViewport
      ? Math.max(0, Math.round(window.visualViewport.offsetTop || 0))
      : 0;
    root.style.setProperty('--visual-viewport-offset-top', `${viewportOffsetTop}px`);
  };

  const updateProgressBar = () => {
    const scrollElement = document.scrollingElement || document.documentElement || document.body;
    const viewportHeight = window.visualViewport?.height || window.innerHeight || root.clientHeight || scrollElement.clientHeight || 1;
    const maxScrollableDistance = Math.max(scrollElement.scrollHeight - viewportHeight, 1);
    const scrollTop = Math.max(0, window.scrollY || scrollElement.scrollTop || root.scrollTop || document.body.scrollTop || 0);
    const progress = scrollTop / maxScrollableDistance;
    const safeProgress = Math.max(0, Math.min(1, progress));
    root.style.setProperty('--site-scroll-progress', `${safeProgress * 100}%`);
    document.body.style.setProperty('--site-scroll-progress', `${safeProgress * 100}%`);
  };

  let frameRequested = false;
  const scheduleProgressUpdate = () => {
    if (frameRequested) return;
    frameRequested = true;

    window.requestAnimationFrame(() => {
      updateHeaderOffset();
      updateProgressBar();
      frameRequested = false;
    });
  };

  scheduleProgressUpdate();
  window.addEventListener('scroll', scheduleProgressUpdate, { passive: true });
  window.addEventListener('resize', scheduleProgressUpdate);
  window.addEventListener('orientationchange', scheduleProgressUpdate);
  window.addEventListener('load', scheduleProgressUpdate);
  document.addEventListener('layout:loaded', scheduleProgressUpdate);
  window.visualViewport?.addEventListener('resize', scheduleProgressUpdate);
  window.visualViewport?.addEventListener('scroll', scheduleProgressUpdate);
}

function initStandaloneSplashScreen() {
  if (document.body?.dataset.page !== 'index') return;

  const splash = document.getElementById('app-launch-splash');
  if (!splash) return;
  if (sessionStorage.getItem(RCC_STORAGE_KEYS.splashSeen) === '1') {
    splash.setAttribute('hidden', 'hidden');
    document.body.classList.add('splash-done');
    return;
  }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const shouldShowSplash = isStandaloneMode() || isMobileDevice();
  if (!shouldShowSplash) return;

  sessionStorage.setItem(RCC_STORAGE_KEYS.splashSeen, '1');
  document.body.classList.add('splash-active');
  window.setTimeout(() => {
    document.body.classList.add('splash-exit');
    window.setTimeout(() => {
      document.body.classList.remove('splash-active', 'splash-exit');
      document.body.classList.add('splash-done');
      window.setTimeout(() => splash.setAttribute('hidden', 'hidden'), 520);
    }, 480);
  }, 1650);
}

function initFormulaOneLoader() {
  if (document.body?.dataset.f1LoaderBound === 'true') return;
  document.body.dataset.f1LoaderBound = 'true';

  const loader = document.createElement('div');
  loader.className = 'f1-loader-overlay';
  loader.setAttribute('aria-hidden', 'true');
  loader.innerHTML = `
    <div class="f1-loader" role="status" aria-live="polite" aria-label="Inhalt wird geladen">
      <div class="f1-loader-lights" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <p>Race Control lädt…</p>
    </div>
  `;

  document.body.appendChild(loader);
  document.body.classList.add('f1-loading');
  const lights = Array.from(loader.querySelectorAll('.f1-loader-lights span'));
  const lightColumns = [
    [0, 5],
    [1, 6],
    [2, 7],
    [3, 8],
    [4, 9]
  ];
  let activeColumn = -1;
  let startLightTimer = null;
  let resetLightTimer = null;

  const setColumnState = (columnIndex, state) => {
    const indexes = lightColumns[columnIndex] || [];
    indexes.forEach((lightIndex) => lights[lightIndex]?.classList.toggle(state, true));
  };

  const clearLightStates = () => {
    lights.forEach((light) => light.classList.remove('is-red', 'is-green'));
    activeColumn = -1;
  };

  const runLightSequence = () => {
    clearLightStates();

    startLightTimer = window.setInterval(() => {
      if (activeColumn < lightColumns.length - 1) {
        activeColumn += 1;
        setColumnState(activeColumn, 'is-red');
        return;
      }

      window.clearInterval(startLightTimer);
      startLightTimer = null;
      lights.forEach((light) => {
        light.classList.remove('is-red');
        light.classList.add('is-green');
      });

      resetLightTimer = window.setTimeout(runLightSequence, 1000);
    }, 320);
  };

  runLightSequence();

  const hideLoader = () => {
    document.body.classList.remove('f1-loading');
    if (startLightTimer) window.clearInterval(startLightTimer);
    if (resetLightTimer) window.clearTimeout(resetLightTimer);
    loader.classList.add('is-hidden');
    window.setTimeout(() => loader.remove(), 500);
  };

  const waitForPageContent = async () => {
    const images = Array.from(document.images || []);
    const pendingImages = images.filter((img) => !img.complete);

    await Promise.allSettled(
      pendingImages.map((img) => new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }))
    );

    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready.catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, 1800))
      ]);
    }
  };

  const hasWarmDashboardCache = () => {
    if (document.body?.dataset.page !== 'index') return false;
    return window.RCCData?.hasFreshDashboardCache?.() === true;
  };

  const hasWarmPageCache = () => {
    const page = document.body?.dataset.page || '';
    if (!window.RCCData?.readCachedValue || !window.RCCData?.buildCacheKey) return false;

    const currentSeason = window.RCCData.readCachedValue(
      window.RCCData.buildCacheKey('currentSeason'),
      window.RCCData.QUERY_CACHE_TTL?.season || 0
    );

    if (!currentSeason?.id) return false;

    if (page === 'index') return hasWarmDashboardCache();
    if (!['ergebnisse', 'fahrer-wm', 'team-wm'].includes(page)) return false;

    const races = window.RCCData.readCachedValue(
      window.RCCData.buildCacheKey('races', { seasonId: currentSeason.id }),
      window.RCCData.QUERY_CACHE_TTL?.races || 0
    );
    const drivers = window.RCCData.readCachedValue(
      window.RCCData.buildCacheKey('drivers'),
      window.RCCData.QUERY_CACHE_TTL?.drivers || 0
    );

    return Array.isArray(races) && races.length > 0 && Array.isArray(drivers) && drivers.length > 0;
  };

  const waitForDashboardContent = () => {
    if (document.body?.dataset.page !== 'index') return Promise.resolve();

    if (hasWarmDashboardCache()) {
      window.RCCData?.warmDashboardCache?.().catch(() => undefined);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        document.removeEventListener('dashboard:content-ready', onReady);
        window.clearTimeout(timeoutId);
        resolve();
      };
      const onReady = () => finish();
      const timeoutId = window.setTimeout(finish, 12000);
      document.addEventListener('dashboard:content-ready', onReady, { once: true });
    });
  };


  const waitForAsyncPageContent = () => {
    const page = document.body?.dataset.page || '';
    const pagesWithAsyncContent = new Set(['ergebnisse', 'fahrer-wm', 'team-wm']);

    if (!pagesWithAsyncContent.has(page)) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        document.removeEventListener('rcc:page-content-ready', onReady);
        window.clearTimeout(timeoutId);
        resolve();
      };
      const onReady = (event) => {
        if (event?.detail?.page && event.detail.page !== page) return;
        finish();
      };
      const timeoutId = window.setTimeout(finish, 12000);
      document.addEventListener('rcc:page-content-ready', onReady);
    });
  };

  const finalizeLoader = () => {
    if (hasWarmPageCache()) {
      window.RCCData?.warmDashboardCache?.().catch(() => undefined);
      window.requestAnimationFrame(hideLoader);
      return;
    }
    Promise.allSettled([
      waitForDashboardContent(),
      waitForAsyncPageContent(),
      waitForPageContent()
    ]).finally(() => window.requestAnimationFrame(hideLoader));
  };

  if (document.readyState === 'complete') {
    finalizeLoader();
    return;
  }

  window.addEventListener('load', finalizeLoader, { once: true });
}

function initNavigation() {
  const navToggle = document.querySelector('[data-nav-toggle]');
  const mainNav = document.querySelector('[data-main-nav]');
  const moreWrap = document.querySelector('[data-nav-more]');
  const moreToggle = document.querySelector('[data-nav-more-toggle]');
  const moreMenu = document.querySelector('[data-nav-more-menu]');

  if (!navToggle || !mainNav || navToggle.dataset.bound === 'true') {
    return;
  }

  const closeNav = () => {
    mainNav.classList.remove('open');
    document.body.classList.remove('nav-drawer-open');
    navToggle.setAttribute('aria-expanded', 'false');
    if (moreWrap) {
      moreWrap.classList.remove('open');
      moreToggle?.setAttribute('aria-expanded', 'false');
    }
  };

  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    document.body.classList.toggle('nav-drawer-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
    if (!isOpen && moreWrap) {
      moreWrap.classList.remove('open');
      moreToggle?.setAttribute('aria-expanded', 'false');
    }
  });

  moreToggle?.addEventListener('click', () => {
    const isOpen = moreWrap.classList.toggle('open');
    moreToggle.setAttribute('aria-expanded', String(isOpen));
  });

  mainNav.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    closeNav();
  });

  document.addEventListener('click', (event) => {
    if (!mainNav.classList.contains('open')) return;
    if (mainNav.contains(event.target) || navToggle.contains(event.target)) return;
    closeNav();
  });

  document.addEventListener('click', (event) => {
    if (!moreWrap || !moreWrap.classList.contains('open')) return;
    if (moreWrap.contains(event.target)) return;
    moreWrap.classList.remove('open');
    moreToggle?.setAttribute('aria-expanded', 'false');
  });

  const closeMoreIfDesktop = () => {
    if (!window.matchMedia('(max-width: 860px)').matches && moreWrap) {
      moreWrap.classList.remove('open');
      moreToggle?.setAttribute('aria-expanded', 'false');
    }
    if (!window.matchMedia('(max-width: 860px)').matches) {
      closeNav();
      document.body.classList.remove('nav-drawer-open');
    }
  };
  window.addEventListener('resize', closeMoreIfDesktop);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mainNav.classList.contains('open')) {
      closeNav();
    }
  });

  navToggle.dataset.bound = 'true';
}

function loadJsonFromStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function saveJsonToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

window.RCC_STORAGE_KEYS = RCC_STORAGE_KEYS;
window.saveRaceSchedule = (entries) => saveJsonToStorage(RCC_STORAGE_KEYS.schedule, entries);
window.loadRaceSchedule = () => loadJsonFromStorage(RCC_STORAGE_KEYS.schedule);
window.saveStewardNotes = (notes) => saveJsonToStorage(RCC_STORAGE_KEYS.stewardNotes, notes);
window.loadStewardNotes = () => loadJsonFromStorage(RCC_STORAGE_KEYS.stewardNotes);
window.saveImportedCsv = (text) => localStorage.setItem(RCC_STORAGE_KEYS.importedCsv, text);
window.loadImportedCsv = () => localStorage.getItem(RCC_STORAGE_KEYS.importedCsv) || '';
window.initNavigation = initNavigation;
window.initTrackMapModal = initTrackMapModal;



function ensureTrackMapModal() {
  if (document.getElementById('trackmap-lightbox')) return;

  const modal = document.createElement('div');
  modal.id = 'trackmap-lightbox';
  modal.className = 'trackmap-lightbox hidden';
  modal.innerHTML = `
    <div class="trackmap-lightbox-backdrop" data-trackmap-close></div>
    <div class="trackmap-lightbox-dialog" role="dialog" aria-modal="true" aria-labelledby="trackmap-lightbox-title">
      <button type="button" class="trackmap-lightbox-close" data-trackmap-close aria-label="Track Map schließen">×</button>
      <div class="trackmap-lightbox-title" id="trackmap-lightbox-title">Track Map</div>
      <img id="trackmap-lightbox-image" class="trackmap-lightbox-image" src="" alt="Vergrößerte Track Map">
    </div>
  `;
  document.body.appendChild(modal);
}

let trackMapLastFocusedElement = null;

function trapFocusInModal(event) {
  const modal = document.getElementById('trackmap-lightbox');
  if (!modal || modal.classList.contains('hidden')) return;
  if (event.key !== 'Tab') return;

  const focusables = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function closeTrackMapModal() {
  const modal = document.getElementById('trackmap-lightbox');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');

  if (trackMapLastFocusedElement && typeof trackMapLastFocusedElement.focus === 'function') {
    trackMapLastFocusedElement.focus();
  }
  trackMapLastFocusedElement = null;
}

function openTrackMapModal(src, title, triggerElement) {
  ensureTrackMapModal();
  const modal = document.getElementById('trackmap-lightbox');
  const image = document.getElementById('trackmap-lightbox-image');
  const titleEl = document.getElementById('trackmap-lightbox-title');
  const closeBtn = modal?.querySelector('.trackmap-lightbox-close');
  if (!modal || !image || !titleEl) return;
  trackMapLastFocusedElement = triggerElement || document.activeElement;
  image.src = src;
  image.alt = title || 'Vergrößerte Track Map';
  titleEl.textContent = title || 'Track Map';
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  if (closeBtn) closeBtn.focus();
}

function initTrackMapModal() {
  if (document.body.dataset.trackmapBound === 'true') return;
  document.body.dataset.trackmapBound = 'true';
  ensureTrackMapModal();

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-trackmap-open]');
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      openTrackMapModal(
        trigger.dataset.trackmapOpen,
        trigger.dataset.trackmapTitle || 'Track Map',
        trigger
      );
      return;
    }

    if (event.target.closest('[data-trackmap-close]')) {
      closeTrackMapModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeTrackMapModal();
      return;
    }
    trapFocusInModal(event);
  });
}



function ensureTrackInfoModal() {
  if (document.getElementById('trackinfo-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'trackinfo-modal';
  modal.className = 'trackmap-lightbox hidden';
  modal.innerHTML = `
    <div class="trackmap-lightbox-backdrop" data-trackinfo-close></div>
    <div class="trackmap-lightbox-dialog trackinfo-dialog" role="dialog" aria-modal="true" aria-labelledby="trackinfo-title">
      <button type="button" class="trackmap-lightbox-close" data-trackinfo-close aria-label="Streckeninfos schließen">×</button>
      <h3 class="trackmap-lightbox-title" id="trackinfo-title"></h3>
      <div id="trackinfo-content" class="trackinfo-grid"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

let trackInfoLastFocusedElement = null;

function renderTrackInfoContent(info) {
  if (!info) {
    return '<p class="trackinfo-fallback">Für diese Strecke sind noch keine Detailinformationen hinterlegt.</p>';
  }
  const contract = window.formatF1Contract ? window.formatF1Contract(info.f1ContractUntil) : 'unbekannt';
  const rows = [
    ['Kurzname / Ort', info.shortName],
    ['Land', info.country],
    ['Streckenlänge', info.lengthKm],
    ['F1-Renndistanz', info.raceDistanceKm],
    ['F1-Runden', info.laps],
    ['Erster Formel-1-Grand-Prix', info.firstGrandPrix],
    ['Offizieller F1-Rundenrekord', info.lapRecord],
    ['Zuschauerkapazität', info.capacity],
    ['F1 Vertrag', contract],
    ['Anzahl Kurven', info.corners],
    ['DRS-Zonen', info.drsZones],
    ['Streckentyp', info.trackType],
    ['Fahrtrichtung', info.direction],
    ['Bekannte Kurven', (info.famousCorners || []).join(', ') || '—']
  ];
  return rows.map(([label, value]) => `<div class="trackinfo-item"><span>${label}</span><strong>${window.escapeHtml(String(value ?? '—'))}</strong></div>`).join('');
}

function openTrackInfoModal(trackName, triggerElement) {
  ensureTrackInfoModal();
  const modal = document.getElementById('trackinfo-modal');
  const titleEl = document.getElementById('trackinfo-title');
  const contentEl = document.getElementById('trackinfo-content');
  const info = window.getTrackInfo?.(trackName);
  if (!modal || !titleEl || !contentEl) return;
  trackInfoLastFocusedElement = triggerElement || document.activeElement;
  const heading = info ? `${info.officialName} – ${info.shortName}` : (trackName || 'Streckeninfos');
  titleEl.textContent = heading;
  contentEl.innerHTML = renderTrackInfoContent(info);
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  modal.querySelector('.trackmap-lightbox-close')?.focus();
}

function closeTrackInfoModal() {
  const modal = document.getElementById('trackinfo-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  if (trackInfoLastFocusedElement && typeof trackInfoLastFocusedElement.focus === 'function') {
    trackInfoLastFocusedElement.focus();
  }
  trackInfoLastFocusedElement = null;
}

function initTrackInfoModal() {
  if (document.body.dataset.trackinfoBound === 'true') return;
  document.body.dataset.trackinfoBound = 'true';
  ensureTrackInfoModal();

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-trackinfo-open]');
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      openTrackInfoModal(trigger.dataset.trackinfoOpen || '', trigger);
      return;
    }
    if (event.target.closest('[data-trackinfo-close]')) closeTrackInfoModal();
  });

  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target?.closest?.('[data-trackinfo-open]')) {
      event.preventDefault();
      openTrackInfoModal(event.target.closest('[data-trackinfo-open]').dataset.trackinfoOpen || '', event.target.closest('[data-trackinfo-open]'));
      return;
    }
    if (event.key === 'Escape') closeTrackInfoModal();
  });
}
document.addEventListener('DOMContentLoaded', initNavigation);
document.addEventListener('DOMContentLoaded', initTrackMapModal);
document.addEventListener('DOMContentLoaded', initTrackInfoModal);
document.addEventListener('DOMContentLoaded', initStandaloneSplashScreen);
document.addEventListener('DOMContentLoaded', initGlobalScrollProgress);
document.addEventListener('DOMContentLoaded', initFormulaOneLoader);
document.addEventListener('layout:loaded', initNavigation);
document.addEventListener('layout:loaded', initTrackMapModal);
document.addEventListener('layout:loaded', initTrackInfoModal);
