(() => {
  const esc = (value) => window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '');
  const format = (value) => Number.isInteger(Number(value)) ? String(Number(value || 0)) : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(Number(value || 0));

  function href(file, params) {
    const base = window.withLeagueContextHref?.(file) || file;
    const url = new URL(base, window.location.href);
    Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  function leader(rows, field, options = {}) {
    const usable = (rows || []).filter((entry) => options.filter ? options.filter(entry) : true);
    const direction = options.lowerIsBetter ? 1 : -1;
    return usable.sort((a, b) => {
      const left = Number(a?.[field]);
      const right = Number(b?.[field]);
      if (left !== right) return (left - right) * direction;
      return String(a.driver?.display_name || a.teamName || '').localeCompare(String(b.driver?.display_name || b.teamName || ''), 'de');
    })[0] || null;
  }

  function recordCard({ label, name, value, detail, url }) {
    const body = `<span>${esc(label)}</span><strong>${esc(name || '—')}</strong><small>${esc(value)}${detail ? ` · ${esc(detail)}` : ''}</small>`;
    return `<article class="platform-record-card">${url ? `<a href="${esc(url)}">${body}</a>` : body}</article>`;
  }

  function renderDriverRecords(stats) {
    const host = document.getElementById('hof-driver-records');
    if (!host) return;
    const records = [
      ['Meiste Siege', 'wins', 'Siege'],
      ['Meiste Podien', 'podiums', 'Podien'],
      ['Meiste Poles', 'poles', 'Poles'],
      ['Schnellste Runden', 'fastestLaps', 'schnellste Runden'],
      ['Meiste Punkte', 'points', 'Punkte'],
      ['Meiste Starts', 'starts', 'Starts']
    ];
    host.innerHTML = records.map(([label, field, unit]) => {
      const item = leader([...stats], field);
      return recordCard({
        label,
        name: item?.driver?.display_name,
        value: item ? `${format(item[field])} ${unit}` : 'Keine Daten',
        url: item ? href('fahrer-profil.html', { driver: item.driver.id }) : ''
      });
    }).join('');
  }

  function renderTeamRecords(stats) {
    const host = document.getElementById('hof-team-records');
    if (!host) return;
    const records = [
      ['Meiste Punkte', 'points', 'Punkte'],
      ['Meiste Siege', 'wins', 'Siege'],
      ['Meiste Podien', 'podiums', 'Podien'],
      ['Meiste Poles', 'poles', 'Poles'],
      ['Schnellste Runden', 'fastestLaps', 'schnellste Runden'],
      ['Meiste Rennteilnahmen', 'races', 'Rennen']
    ];
    host.innerHTML = records.map(([label, field, unit]) => {
      const item = leader([...stats], field);
      return recordCard({
        label,
        name: item?.teamName,
        value: item ? `${format(item[field])} ${unit}` : 'Keine Daten',
        url: item ? href('team-profil.html', { team: item.teamName }) : ''
      });
    }).join('');
  }

  async function init() {
    const status = document.getElementById('hof-live-records-status');
    try {
      const history = await window.RCCDriverStats.loadLeagueHistory();
      const driverStats = history.drivers.map((driver) => window.RCCDriverStats.calculateDriverStats(driver.id, history)).filter((entry) => entry?.starts > 0);
      const teamStats = window.RCCTeamStats.calculateAllTeamStats(history).filter((entry) => entry.races > 0);
      renderDriverRecords(driverStats);
      renderTeamRecords(teamStats);
      if (status) status.textContent = `${driverStats.length} Fahrer · ${teamStats.length} Teams · ${history.completedRaces.length} gewertete Rennen`;
    } catch (error) {
      console.error('RaceVora Hall-of-Fame Rekorde:', error);
      if (status) status.textContent = 'Live-Rennrekorde konnten nicht geladen werden.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
