(() => {
  const normalize = (value) => String(value || '').trim().toLocaleLowerCase('de');

  function scopedProfileHref(driverId) {
    const base = window.withLeagueContextHref?.('fahrer-profil.html') || 'fahrer-profil.html';
    const url = new URL(base, window.location.href);
    url.searchParams.set('driver', String(driverId));
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  function decorateTable(tbody, driverCellIndex, idsByName) {
    if (!tbody) return null;
    const applyLinks = () => {
      tbody.querySelectorAll('tr').forEach((row) => {
        const cell = row.children?.[driverCellIndex];
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
    return observer;
  }

  async function init() {
    const standingsBody = document.getElementById('drivers-standings-body');
    const raceResultsBody = document.getElementById('results-body');
    if ((!standingsBody && !raceResultsBody) || !window.RCCData) return;

    let drivers = [];
    try {
      drivers = await window.RCCData.fetchDrivers();
    } catch (error) {
      console.warn('RaceVora Fahrerprofil-Links konnten nicht vorbereitet werden.', error);
      return;
    }

    const idsByName = new Map((drivers || []).map((driver) => [normalize(driver.display_name), driver.id]));
    decorateTable(standingsBody, 2, idsByName);
    decorateTable(raceResultsBody, 1, idsByName);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
