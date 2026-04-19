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

  const updateProgressBar = () => {
    const root = document.documentElement;
    const scrollElement = document.scrollingElement || document.documentElement || document.body;
    const viewportHeight = window.innerHeight || root.clientHeight || scrollElement.clientHeight || 1;
    const maxScrollableDistance = Math.max(scrollElement.scrollHeight - viewportHeight, 1);
    const scrollTop = Math.max(window.scrollY || 0, scrollElement.scrollTop || 0, root.scrollTop || 0, document.body.scrollTop || 0);
    const progress = scrollTop / maxScrollableDistance;
    const safeProgress = Math.max(0, Math.min(1, progress));
    root.style.setProperty('--site-scroll-progress', `${safeProgress * 100}%`);
    document.body.style.setProperty('--site-scroll-progress', `${safeProgress * 100}%`);
  };

  updateProgressBar();
  window.addEventListener('scroll', updateProgressBar, { passive: true });
  window.addEventListener('resize', updateProgressBar);
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

function initNavigation() {
  const navToggle = document.querySelector('[data-nav-toggle]');
  const mainNav = document.querySelector('[data-main-nav]');

  if (!navToggle || !mainNav || navToggle.dataset.bound === 'true') {
    return;
  }

  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
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

document.addEventListener('DOMContentLoaded', initNavigation);
document.addEventListener('DOMContentLoaded', initTrackMapModal);
document.addEventListener('DOMContentLoaded', initStandaloneSplashScreen);
document.addEventListener('DOMContentLoaded', initGlobalScrollProgress);
document.addEventListener('layout:loaded', initNavigation);
document.addEventListener('layout:loaded', initTrackMapModal);
