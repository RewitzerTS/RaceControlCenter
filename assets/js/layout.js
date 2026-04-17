const RCC_LAYOUT_TARGETS = [
  { selector: '#site-header', file: 'components/header.html' },
  { selector: '#site-footer', file: 'components/footer.html' }
];
const RCC_LANGUAGE_STORAGE_KEY = 'rcc-language';
const RCC_SUPPORTED_LANGUAGES = ['de', 'en', 'fr', 'es'];
const RCC_TRANSLATE_COOKIE_NAME = 'googtrans';
const RCC_SOURCE_LANGUAGE = 'de';

function getPreferredLanguage() {
  const storedLanguage = localStorage.getItem(RCC_LANGUAGE_STORAGE_KEY);
  return RCC_SUPPORTED_LANGUAGES.includes(storedLanguage) ? storedLanguage : 'de';
}

function applyPreferredLanguage() {
  document.documentElement.lang = getPreferredLanguage();
}

function resolveCurrentPage() {
  const pageFromBody = document.body?.dataset?.page?.trim();
  if (pageFromBody) {
    return pageFromBody;
  }

  const fileName = window.location.pathname.split('/').pop() || 'index.html';
  return fileName.replace(/\.html$/i, '');
}

function updateActiveNavigation() {
  const currentPage = resolveCurrentPage();
  const navLinks = document.querySelectorAll('[data-nav-link]');

  navLinks.forEach((link) => {
    const isActive = link.dataset.navLink === currentPage;
    link.classList.toggle('active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

async function injectLayoutPart(selector, file) {
  const target = document.querySelector(selector);
  if (!target) return;

  const response = await fetch(file);

  if (!response.ok) {
    throw new Error(`Layout-Datei konnte nicht geladen werden: ${file}`);
  }

  target.innerHTML = await response.text();
}

function injectLayoutFallback() {
  const header = document.querySelector('#site-header');
  if (header && !header.innerHTML.trim()) {
    header.innerHTML = `
      <header class="site-header fallback-layout">
        <a class="brand" href="index.html">Race Control Center</a>
        <div class="notice">Navigation konnte nicht geladen werden.</div>
      </header>
    `;
  }

  const footer = document.querySelector('#site-footer');
  if (footer && !footer.innerHTML.trim()) {
    footer.innerHTML = `
      <footer class="site-footer fallback-layout">
        <p>Footer konnte nicht geladen werden.</p>
      </footer>
    `;
  }
}

async function loadSiteLayout() {
  try {
    await Promise.all(
      RCC_LAYOUT_TARGETS.map((item) => injectLayoutPart(item.selector, item.file))
    );

    updateActiveNavigation();
    document.dispatchEvent(new CustomEvent('layout:loaded'));
  } catch (error) {
    console.error(error);
    injectLayoutFallback();
    updateActiveNavigation();
    document.dispatchEvent(new CustomEvent('layout:loaded'));
  }
}

function setTranslationCookie(targetLanguage) {
  const cookieValue = `/${RCC_SOURCE_LANGUAGE}/${targetLanguage}`;
  const maxAge = 60 * 60 * 24 * 365;

  document.cookie = `${RCC_TRANSLATE_COOKIE_NAME}=${cookieValue};path=/;max-age=${maxAge}`;

  if (window.location.hostname && window.location.hostname !== 'localhost') {
    document.cookie = `${RCC_TRANSLATE_COOKIE_NAME}=${cookieValue};path=/;domain=${window.location.hostname};max-age=${maxAge}`;
  }
}

function clearTranslationCookie() {
  document.cookie = `${RCC_TRANSLATE_COOKIE_NAME}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;

  if (window.location.hostname && window.location.hostname !== 'localhost') {
    document.cookie = `${RCC_TRANSLATE_COOKIE_NAME}=;path=/;domain=${window.location.hostname};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

function ensureGoogleTranslateContainer() {
  if (document.getElementById('google_translate_element')) return;

  const container = document.createElement('div');
  container.id = 'google_translate_element';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);
}

let googleTranslateLoadPromise = null;

function loadGoogleTranslateScript() {
  if (googleTranslateLoadPromise) return googleTranslateLoadPromise;

  googleTranslateLoadPromise = new Promise((resolve, reject) => {
    ensureGoogleTranslateContainer();

    window.googleTranslateElementInit = () => {
      if (!window.google || !window.google.translate) {
        reject(new Error('Google Translate API nicht verfügbar.'));
        return;
      }

      new window.google.translate.TranslateElement(
        {
          pageLanguage: RCC_SOURCE_LANGUAGE,
          includedLanguages: RCC_SUPPORTED_LANGUAGES.filter((lang) => lang !== RCC_SOURCE_LANGUAGE).join(','),
          autoDisplay: false
        },
        'google_translate_element'
      );

      resolve();
    };

    const existingScript = document.querySelector('script[data-google-translate="true"]');
    if (existingScript) return;

    const script = document.createElement('script');
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    script.defer = true;
    script.dataset.googleTranslate = 'true';
    script.onerror = () => reject(new Error('Google Translate Script konnte nicht geladen werden.'));
    document.head.appendChild(script);
  });

  return googleTranslateLoadPromise;
}

function applyGoogleTranslateLanguage(targetLanguage) {
  const select = document.querySelector('.goog-te-combo');
  if (!select) return false;

  if (select.value === targetLanguage) return true;

  select.value = targetLanguage;
  select.dispatchEvent(new Event('change'));
  return true;
}

async function applyLanguageSelection(selectedLanguage, { forceReload = false } = {}) {
  document.documentElement.lang = selectedLanguage;

  if (selectedLanguage === RCC_SOURCE_LANGUAGE) {
    clearTranslationCookie();
    if (forceReload) {
      window.location.reload();
    }
    return;
  }

  setTranslationCookie(selectedLanguage);

  try {
    await loadGoogleTranslateScript();

    let isApplied = applyGoogleTranslateLanguage(selectedLanguage);

    if (!isApplied) {
      window.setTimeout(() => applyGoogleTranslateLanguage(selectedLanguage), 220);
      window.setTimeout(() => applyGoogleTranslateLanguage(selectedLanguage), 600);
      if (forceReload) {
        window.setTimeout(() => window.location.reload(), 900);
      }
    }
  } catch (error) {
    console.warn(error);
    if (forceReload) {
      window.location.reload();
    }
  }
}

window.resolveCurrentPage = resolveCurrentPage;
window.updateActiveNavigation = updateActiveNavigation;
window.loadSiteLayout = loadSiteLayout;


document.addEventListener('DOMContentLoaded', loadSiteLayout);
document.addEventListener('DOMContentLoaded', applyPreferredLanguage);

document.addEventListener('DOMContentLoaded', () => {
  const preferredLanguage = getPreferredLanguage();
  if (preferredLanguage !== RCC_SOURCE_LANGUAGE) {
    applyLanguageSelection(preferredLanguage);
  }
});


function setupAdminShortcut() {
  const brandLink = document.querySelector('.brand');
  if (!brandLink || brandLink.dataset.adminShortcutBound === 'true') return;

  const homeHref = brandLink.getAttribute('href') || 'index.html';
  let clickTimer = null;

  brandLink.addEventListener('click', (event) => {
    event.preventDefault();
    if (clickTimer) {
      clearTimeout(clickTimer);
    }

    clickTimer = window.setTimeout(() => {
      window.location.href = homeHref;
    }, 220);
  });

  brandLink.addEventListener('dblclick', (event) => {
    event.preventDefault();
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }

    window.location.href = 'admin.html';
  });

  brandLink.dataset.adminShortcutBound = 'true';
}

document.addEventListener('layout:loaded', setupAdminShortcut);

function setupLanguageSelector() {
  const languageSelect = document.querySelector('#footer-language-select');
  if (!languageSelect || languageSelect.dataset.initialized === 'true') return;

  languageSelect.value = getPreferredLanguage();

  languageSelect.addEventListener('change', async (event) => {
    const selectedLanguage = event.target.value;
    if (!RCC_SUPPORTED_LANGUAGES.includes(selectedLanguage)) return;

    localStorage.setItem(RCC_LANGUAGE_STORAGE_KEY, selectedLanguage);
    await applyLanguageSelection(selectedLanguage, { forceReload: true });
  });

  languageSelect.dataset.initialized = 'true';
}

document.addEventListener('layout:loaded', setupLanguageSelector);
