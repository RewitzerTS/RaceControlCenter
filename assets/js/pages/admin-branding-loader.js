(() => {
  if (document.body?.dataset.page !== 'admin') return;
  function loadBrandingModule() {
    if (window.RCCAdminBranding) return Promise.resolve(window.RCCAdminBranding);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'assets/js/pages/admin-branding.js'; script.onload = () => resolve(window.RCCAdminBranding); script.onerror = () => reject(new Error('Liga-Branding-Modul konnte nicht geladen werden.')); document.head.appendChild(script);
    });
  }
  window.addEventListener('load', async () => { try { const module = await loadBrandingModule(); await module?.init?.(); } catch (error) { console.warn(error); } }, { once: true });
})();
