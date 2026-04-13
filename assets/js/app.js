const RCC_STORAGE_KEYS = {
  schedule: 'rcc_schedule',
  stewardNotes: 'rcc_stewards_notes',
  importedCsv: 'rcc_imported_results'
};

function isStandaloneMode() {
  const standaloneMedia = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = window.navigator.standalone === true;
  return standaloneMedia || iosStandalone;
}

function isMobileDevice() {
  return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
}

function initStandaloneSplashScreen() {
  if (document.body?.dataset.page !== 'index') return;

  const splash = document.getElementById('app-launch-splash');
  if (!splash) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const shouldShowSplash = isStandaloneMode() || isMobileDevice();
  if (!shouldShowSplash) return;

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
    <div class="trackmap-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Track Map Vorschau">
      <button type="button" class="trackmap-lightbox-close" data-trackmap-close aria-label="Track Map schließen">×</button>
      <div class="trackmap-lightbox-title" id="trackmap-lightbox-title">Track Map</div>
      <img id="trackmap-lightbox-image" class="trackmap-lightbox-image" src="" alt="Vergrößerte Track Map">
    </div>
  `;
  document.body.appendChild(modal);
}

function closeTrackMapModal() {
  const modal = document.getElementById('trackmap-lightbox');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function openTrackMapModal(src, title) {
  ensureTrackMapModal();
  const modal = document.getElementById('trackmap-lightbox');
  const image = document.getElementById('trackmap-lightbox-image');
  const titleEl = document.getElementById('trackmap-lightbox-title');
  if (!modal || !image || !titleEl) return;
  image.src = src;
  image.alt = title || 'Vergrößerte Track Map';
  titleEl.textContent = title || 'Track Map';
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
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
      openTrackMapModal(trigger.dataset.trackmapOpen, trigger.dataset.trackmapTitle || 'Track Map');
      return;
    }

    if (event.target.closest('[data-trackmap-close]')) {
      closeTrackMapModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeTrackMapModal();
  });
}

document.addEventListener('DOMContentLoaded', initNavigation);
document.addEventListener('DOMContentLoaded', initTrackMapModal);
document.addEventListener('DOMContentLoaded', initStandaloneSplashScreen);
document.addEventListener('layout:loaded', initNavigation);
document.addEventListener('layout:loaded', initTrackMapModal);
