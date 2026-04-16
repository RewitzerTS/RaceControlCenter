const RCC_LAYOUT_TARGETS = [
  { selector: '#site-header', file: 'components/header.html' },
  { selector: '#site-footer', file: 'components/footer.html' }
];

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

window.resolveCurrentPage = resolveCurrentPage;
window.updateActiveNavigation = updateActiveNavigation;
window.loadSiteLayout = loadSiteLayout;

document.addEventListener('DOMContentLoaded', loadSiteLayout);


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
