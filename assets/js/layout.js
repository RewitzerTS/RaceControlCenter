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

function updateAdminHeaderVisibility() {
  const adminAuth = document.getElementById('admin-header-auth');
  if (!adminAuth) return;
  adminAuth.hidden = resolveCurrentPage() !== 'admin';
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

async function loadSiteLayout() {
  try {
    await Promise.all(
      RCC_LAYOUT_TARGETS.map((item) => injectLayoutPart(item.selector, item.file))
    );

    updateActiveNavigation();
    updateAdminHeaderVisibility();
    document.dispatchEvent(new CustomEvent('layout:loaded'));
  } catch (error) {
    console.error(error);
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
