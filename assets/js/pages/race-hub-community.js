(() => {
  if (window.RCCRaceHubCommunity) return;

  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '');

  function href(file, params = {}) {
    const base = window.withLeagueContextHref?.(file) || file;
    const url = new URL(base, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
    });
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  async function resolveSeason(history) {
    const current = await window.RCCData?.fetchCurrentSeason?.().catch(() => null);
    if (current?.id) return current;
    return [...(history?.seasons || [])].sort((a, b) => {
      const left = Date.parse(a.start_date || a.created_at || 0) || 0;
      const right = Date.parse(b.start_date || b.created_at || 0) || 0;
      return right - left;
    })[0] || null;
  }

  function renderFormDrivers(history, seasonId) {
    const host = byId('race-hub-form-drivers');
    if (!host) return;
    const ratings = (history.drivers || []).map((driver) => {
      const rating = window.RCCDriverPerformance?.calculate?.(driver.id, history, { seasonId: seasonId || null });
      return { driver, rating };
    }).filter((entry) => Number.isFinite(entry.rating?.score) && entry.rating.sampleSize > 0)
      .sort((a, b) => b.rating.score - a.rating.score || b.rating.sampleSize - a.rating.sampleSize || String(a.driver.display_name || '').localeCompare(String(b.driver.display_name || ''), 'de'))
      .slice(0, 3);

    if (!ratings.length) {
      host.innerHTML = '<div class="race-hub-community-empty">Sobald veröffentlichte Starts vorhanden sind, erscheint hier das aktuelle Formranking.</div>';
      return;
    }

    host.innerHTML = ratings.map((entry, index) => {
      const trend = Number(entry.rating.trend);
      const hasTrend = Number.isFinite(trend) && entry.rating.previousSampleSize >= 2;
      const trendClass = hasTrend && trend > 0 ? 'is-up' : (hasTrend && trend < 0 ? 'is-down' : '');
      const trendText = hasTrend ? `${trend > 0 ? '+' : ''}${Math.round(trend)} Trend` : `${entry.rating.sampleSize} Starts`;
      return `<a class="race-hub-form-driver" href="${esc(href('fahrer-profil.html', { driver: entry.driver.id, season: seasonId || null }))}">
        <span class="race-hub-form-rank">${index + 1}</span>
        <span class="race-hub-form-copy"><strong>${esc(entry.driver.display_name || 'Fahrer')}</strong><small>${esc(entry.rating.label || 'Formrating')} · letzte ${entry.rating.sampleSize} Starts</small></span>
        <span class="race-hub-form-score"><strong>${entry.rating.score}</strong><small class="${trendClass}">${esc(trendText)}</small></span>
      </a>`;
    }).join('');
  }

  function renderHighlights(history, seasonId) {
    const host = byId('race-hub-record-highlights');
    if (!host) return;
    const data = window.RCCRecords?.calculate?.(history, { seasonId: seasonId || null });
    if (!data) {
      host.innerHTML = '<div class="race-hub-community-empty">Rekordhighlights sind noch nicht verfügbar.</div>';
      return;
    }
    const s = data.specials || {};
    const pointsLeader = data.leaderboards?.drivers?.points?.[0] || null;
    const cards = [];

    if (s.comeback?.driver) cards.push({
      label: 'Größte Aufholjagd',
      name: s.comeback.driver.display_name,
      value: `+${s.comeback.gain} Plätze`,
      detail: `${s.comeback.race?.grand_prix_name || 'Rennen'} · P${s.comeback.grid} → P${s.comeback.finish}`,
      url: href('fahrer-profil.html', { driver: s.comeback.driver.id, season: seasonId || null })
    });
    if (s.winStreak?.driver) cards.push({
      label: 'Siegesserie',
      name: s.winStreak.driver.display_name,
      value: `${s.winStreak.value} Siege`,
      detail: 'Starts in Folge',
      url: href('fahrer-profil.html', { driver: s.winStreak.driver.id, season: seasonId || null })
    });
    if (s.specialist?.driver) cards.push({
      label: 'Streckenspezialist',
      name: s.specialist.driver.display_name,
      value: `${s.specialist.wins} Siege`,
      detail: s.specialist.track,
      url: href('fahrer-profil.html', { driver: s.specialist.driver.id, season: seasonId || null })
    });
    if (pointsLeader?.driver) cards.push({
      label: 'Punktebenchmark',
      name: pointsLeader.driver.display_name,
      value: `${Number(pointsLeader.points || 0).toLocaleString('de-DE')} Punkte`,
      detail: seasonId ? 'Aktuelle Saison' : 'All-Time',
      url: href('fahrer-profil.html', { driver: pointsLeader.driver.id, season: seasonId || null })
    });

    if (!cards.length) {
      host.innerHTML = '<div class="race-hub-community-empty">Noch nicht genug veröffentlichte Renndaten für Rekordhighlights.</div>';
      return;
    }

    host.innerHTML = cards.slice(0, 4).map((card) => `<a class="race-hub-highlight" href="${esc(card.url)}"><span>${esc(card.label)}</span><strong>${esc(card.name)}</strong><b>${esc(card.value)}</b><small>${esc(card.detail)}</small></a>`).join('');
  }

  function renderExplore(seasonId) {
    const host = byId('race-hub-explore-grid');
    if (!host) return;
    const items = [
      ['◎', 'Fahrer', 'Profile, Form & Karriere', href('fahrer-wm.html', { season: seasonId || null })],
      ['◈', 'Teams', 'Team-WM & Historie', href('team-wm.html', { season: seasonId || null })],
      ['⌁', 'Strecken', 'Streckenprofile & Rekorde', href('strecken.html', { season: seasonId || null })],
      ['⇄', 'Head-to-Head', 'Fahrer direkt vergleichen', href('head-to-head.html', { season: seasonId || null })],
      ['♛', 'Hall of Fame', 'Weltmeister & Legacy', href('hall-of-fame.html')],
      ['★', 'Rekorde', 'All-Time & Saisonrekorde', href('rekorde.html', { season: seasonId || null })]
    ];
    host.innerHTML = items.map(([icon, title, copy, url]) => `<a class="race-hub-explore-link" href="${esc(url)}"><span aria-hidden="true">${icon}</span><strong>${esc(title)}</strong><small>${esc(copy)}</small></a>`).join('');
  }

  async function render() {
    const section = byId('race-hub-community');
    if (!section) return;
    try {
      const history = await window.RCCDriverStats.loadLeagueHistory();
      const season = await resolveSeason(history);
      const seasonId = season?.id || '';
      const seasonLabel = byId('race-hub-community-season');
      if (seasonLabel) seasonLabel.textContent = season?.name || 'All-Time';
      renderFormDrivers(history, seasonId);
      renderHighlights(history, seasonId);
      renderExplore(seasonId);
      section.hidden = false;
    } catch (error) {
      console.error('RaceVora public league hub:', error);
      const form = byId('race-hub-form-drivers');
      const highlights = byId('race-hub-record-highlights');
      if (form) form.innerHTML = '<div class="race-hub-community-empty">Formranking konnte nicht geladen werden.</div>';
      if (highlights) highlights.innerHTML = '<div class="race-hub-community-empty">Highlights konnten nicht geladen werden.</div>';
      renderExplore('');
      section.hidden = false;
    }
  }

  window.RCCRaceHubCommunity = { render };
  document.addEventListener('dashboard:content-ready', render);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})();