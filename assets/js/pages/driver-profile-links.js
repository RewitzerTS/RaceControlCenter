(() => {
  const normalize = (value) => String(value || '').trim().toLocaleLowerCase('de');

  function scopedProfileHref(driverId) {
    const base = window.withLeagueContextHref?.('fahrer-profil.html') || 'fahrer-profil.html';
    const url = new URL(base, window.location.href);
    url.searchParams.set('driver', String(driverId));
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  async function init() {
    const tbody = document.getElementById('drivers-standings-body');
    if (!tbody || !window.RCCData) return;

    let drivers = [];
    try {
      drivers = await window.RCCData.fetchDrivers();
    } catch (error) {
      console.warn('RaceVora Fahrerprofil-Links konnten nicht vorbereitet werden.', error);
      return;
    }

    const idsByName = new Map((drivers || []).map((driver) => [normalize(driver.display_name), driver.id]));

    const applyLinks = () => {
      tbody.querySelectorAll('tr').forEach((row) => {
        const cell = row.children?.[2];
        if (!cell || cell.querySelector('a[data-driver-profile-link]')) return;
        const driverId = idsByName.get(normalize(cell.textContent));
        if (!driverId) return;
        const link = document.createElement('a');
        link.href = scopedProfileHref(driverId);
        link.dataset.driverProfileLink = 'true';
        link.className = 'driver-profile-link';
        link.textContent = cell.textContent.trim();
        link.title = `${link.textContent} Fahrerprofil öffnen`;
        cell.textContent = '';
        cell.appendChild(link);
      });
    };

    applyLinks();
    const observer = new MutationObserver(applyLinks);
    observer.observe(tbody, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
