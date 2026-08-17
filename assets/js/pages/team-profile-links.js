(() => {
  function profileHref(teamName) {
    const base = window.withLeagueContextHref?.('team-profil.html') || 'team-profil.html';
    const url = new URL(base, window.location.href);
    url.searchParams.set('team', String(teamName || '').trim());
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  function decorate(tbody, cellIndex) {
    if (!tbody) return;
    const apply = () => {
      tbody.querySelectorAll('tr').forEach((row) => {
        const cell = row.children?.[cellIndex];
        if (!cell || cell.querySelector('a[data-team-profile-link]')) return;
        const name = cell.textContent.trim();
        if (!name || name === '—' || /laden|fehler/i.test(name)) return;
        const link = document.createElement('a');
        link.href = profileHref(name);
        link.dataset.teamProfileLink = 'true';
        link.className = 'team-profile-link';
        link.textContent = name;
        link.title = `${name} Teamprofil öffnen`;
        cell.textContent = '';
        cell.appendChild(link);
      });
    };
    apply();
    new MutationObserver(apply).observe(tbody, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    decorate(document.getElementById('teams-standings-body'), 2);
    decorate(document.getElementById('results-body'), 2);
  });
})();
