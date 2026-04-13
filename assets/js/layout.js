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

async function loadSiteLayout() {
  try {
    await Promise.all(
      RCC_LAYOUT_TARGETS.map((item) => injectLayoutPart(item.selector, item.file))
    );

    updateActiveNavigation();
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

function updateAdminHeaderAuthUi(session) {
  const wrap = document.querySelector('[data-admin-header-auth]');
  const text = document.querySelector('[data-admin-header-auth-text]');
  const button = document.querySelector('[data-admin-header-auth-btn]');
  if (!wrap || !text || !button) return;

  const isAdminPage = resolveCurrentPage() === 'admin';
  wrap.classList.toggle('hidden', !isAdminPage);
  if (!isAdminPage) return;

  if (session?.user?.email) {
    text.textContent = `Eingeloggt als ${session.user.email}`;
    button.textContent = 'Logout';
    button.dataset.mode = 'logout';
  } else {
    text.textContent = 'Nicht eingeloggt';
    button.textContent = 'Login';
    button.dataset.mode = 'login';
  }
}

function bindAdminHeaderAuthActions() {
  const button = document.querySelector('[data-admin-header-auth-btn]');
  if (!button || button.dataset.bound === 'true') return;

  button.addEventListener('click', async () => {
    if (button.dataset.mode === 'logout' && window.supabaseClient?.auth) {
      await window.supabaseClient.auth.signOut();
      return;
    }

    const authSection = document.getElementById('admin-section-auth');
    if (authSection?.tagName === 'DETAILS') {
      authSection.open = true;
      authSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    document.getElementById('admin-email')?.focus();
  });

  button.dataset.bound = 'true';
}

async function initAdminHeaderAuth() {
  if (!window.supabaseClient?.auth) return;
  const isAdminPage = resolveCurrentPage() === 'admin';
  if (!isAdminPage) {
    updateAdminHeaderAuthUi(null);
    return;
  }

  const { data } = await window.supabaseClient.auth.getSession();
  updateAdminHeaderAuthUi(data?.session || null);
  bindAdminHeaderAuthActions();
  window.supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateAdminHeaderAuthUi(session || null);
  });
}

document.addEventListener('layout:loaded', initAdminHeaderAuth);
