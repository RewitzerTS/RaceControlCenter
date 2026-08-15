(() => {
  if (window.RCCRacingInsights) return;

  const CACHE_PREFIX = 'rcc.racingInsights.v1';
  let renderPromise = null;

  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function leagueSlug() {
    return window.RCCData?.getRequestedLeagueSlug?.() || 'rcc';
  }

  function cacheKey() {
    return `${CACHE_PREFIX}:${leagueSlug()}`;
  }

  function restoreCache() {
    const host = byId('racing-insights-grid');
    if (!host) return false;
    try {
      const raw = window.sessionStorage?.getItem(cacheKey());
      if (!raw) return false;
      const cached = JSON.parse(raw);
      if (!cached?.html) return false;
      host.innerHTML = cached.html;
      return true;
    } catch (_error) {
      return false;
    }
  }

  function saveCache(html) {
    try {
      window.sessionStorage?.setItem(cacheKey(), JSON.stringify({ html, cachedAt: Date.now() }));
    } catch (_error) {
      // Rendering must never depend on storage availability.
    }
  }

  function number(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatPoints(value) {
    const parsed = number(value, 0) || 0;
    return Number.isInteger(parsed) ? String(parsed) : String(parsed).replace('.', ',');
  }

  function groupBy(items, keyFn) {
    const map = new Map();
    (items || []).forEach((item) => {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }

  function lifecycleStatus(race) {
    return window.getRaceLifecycleStatus ? window.getRaceLifecycleStatus(race) : race?.status;
  }

  function getDriverName(driverId, raceId, resolver, driversById) {
    const snapshot = resolver?.resolveDriverSnapshot?.(driverId, raceId) || driversById.get(String(driverId));
    return snapshot?.display_name || 'Unbekannt';
  }

  function getRacePoints(row, fastestId) {
    return Number(window.RCCData?.getAwardedRacePoints?.(row, fastestId) || 0);
  }

  function positionGain(row) {
    const grid = number(row?.grid_position, null);
    const finish = number(row?.finish_position, null);
    if (!Number.isFinite(grid) || !Number.isFinite(finish) || grid < 1 || finish < 1) return null;
    return grid - finish;
  }

  function buildLatestGainer(completedRaces, resultsByRace, resolver, driversById) {
    const latestRace = completedRaces.at(-1);
    if (!latestRace) return null;
    const rows = resultsByRace.get(latestRace.id) || [];
    const candidates = rows
      .map((row) => ({ row, gain: positionGain(row) }))
      .filter((entry) => Number.isFinite(entry.gain))
      .sort((a, b) => b.gain - a.gain || number(a.row.finish_position, 999) - number(b.row.finish_position, 999));
    const best = candidates[0];
    if (!best || best.gain <= 0) return {
      kicker: 'Letztes Rennen',
      title: 'Größter Gewinner',
      value: 'Keine Aufholjagd',
      detail: `${latestRace.grand_prix_name}: Niemand machte netto Positionen gut.`,
      tone: 'gain'
    };
    const name = getDriverName(best.row.driver_id, latestRace.id, resolver, driversById);
    return {
      kicker: 'Letztes Rennen',
      title: 'Größter Gewinner',
      value: `${escapeHtml(name)} · +${best.gain}`,
      detail: `${escapeHtml(latestRace.grand_prix_name)}: von P${best.row.grid_position} auf P${best.row.finish_position}.`,
      tone: 'gain'
    };
  }

  function buildSeasonGainer(completedRaces, resultsByRace, resolver, driversById) {
    const totals = new Map();
    completedRaces.forEach((race) => {
      (resultsByRace.get(race.id) || []).forEach((row) => {
        const gain = positionGain(row);
        if (!Number.isFinite(gain) || gain <= 0) return;
        const key = String(row.driver_id || '');
        if (!key) return;
        const current = totals.get(key) || { gained: 0, races: 0, raceId: race.id };
        current.gained += gain;
        current.races += 1;
        current.raceId = race.id;
        totals.set(key, current);
      });
    });
    const best = [...totals.entries()].sort((a, b) => b[1].gained - a[1].gained || b[1].races - a[1].races)[0];
    if (!best) return null;
    const [driverId, stats] = best;
    const name = getDriverName(driverId, stats.raceId, resolver, driversById);
    return {
      kicker: 'Season Attack',
      title: 'Meiste Plätze gewonnen',
      value: `${escapeHtml(name)} · +${stats.gained}`,
      detail: `${stats.gained} Positionen über ${stats.races} Rennen mit Positionsgewinn.`,
      tone: 'attack'
    };
  }

  function buildPoleToWin(completedRaces, resultsByRace, resolver, driversById) {
    const counts = new Map();
    completedRaces.forEach((race) => {
      (resultsByRace.get(race.id) || []).forEach((row) => {
        if (number(row.grid_position, null) !== 1 || number(row.finish_position, null) !== 1) return;
        const key = String(row.driver_id || '');
        if (!key) return;
        const current = counts.get(key) || { count: 0, raceId: race.id };
        current.count += 1;
        current.raceId = race.id;
        counts.set(key, current);
      });
    });
    const best = [...counts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
    if (!best) return {
      kicker: 'Qualifying → Rennen',
      title: 'Pole-to-Win',
      value: 'Noch keiner',
      detail: 'In dieser Saison wurde noch keine Pole Position in einen Sieg verwandelt.',
      tone: 'pole'
    };
    const [driverId, stats] = best;
    const name = getDriverName(driverId, stats.raceId, resolver, driversById);
    return {
      kicker: 'Qualifying → Rennen',
      title: 'Pole-to-Win',
      value: `${escapeHtml(name)} · ${stats.count}×`,
      detail: stats.count === 1 ? 'Ein Sieg von Startplatz 1.' : `${stats.count} Siege von Startplatz 1.`,
      tone: 'pole'
    };
  }

  function buildRecentForm(completedRaces, resultsByRace, resolver, driversById, fastestByRace) {
    const formRaces = completedRaces.slice(-3);
    if (!formRaces.length) return null;
    const totals = new Map();
    formRaces.forEach((race) => {
      (resultsByRace.get(race.id) || []).forEach((row) => {
        const ownerId = String(row.points_owner_driver_id || row.driver_id || '');
        if (!ownerId) return;
        const current = totals.get(ownerId) || { points: 0, raceId: race.id };
        current.points += getRacePoints(row, fastestByRace.get(race.id));
        current.raceId = race.id;
        totals.set(ownerId, current);
      });
    });
    const best = [...totals.entries()].sort((a, b) => b[1].points - a[1].points)[0];
    if (!best) return null;
    const [driverId, stats] = best;
    const name = getDriverName(driverId, stats.raceId, resolver, driversById);
    const raceLabel = formRaces.length === 1 ? 'dem letzten Rennen' : `den letzten ${formRaces.length} Rennen`;
    return {
      kicker: 'Aktuelle Form',
      title: 'Formstärkster Fahrer',
      value: `${escapeHtml(name)} · ${formatPoints(stats.points)} P`,
      detail: `${formatPoints(stats.points)} Punkte aus ${raceLabel}.`,
      tone: 'form'
    };
  }

  function buildTitleFight(standings) {
    const lead = standings?.driverStandings?.[0];
    const chase = standings?.driverStandings?.[1];
    if (!lead || !chase) return null;
    const gap = Math.max(0, Number(lead.points || 0) - Number(chase.points || 0));
    return {
      kicker: 'WM-Kampf',
      title: 'Titelduell',
      value: `${formatPoints(gap)} Punkte`,
      detail: `${escapeHtml(lead.driverName)} (${formatPoints(lead.points)}) vor ${escapeHtml(chase.driverName)} (${formatPoints(chase.points)}).`,
      tone: 'battle'
    };
  }

  function buildBestStreak(completedRaces, resultsByRace, resolver, driversById) {
    const driverIds = new Set();
    completedRaces.forEach((race) => (resultsByRace.get(race.id) || []).forEach((row) => {
      if (row.driver_id) driverIds.add(String(row.driver_id));
    }));

    let best = null;
    driverIds.forEach((driverId) => {
      let winRun = 0;
      let podiumRun = 0;
      let maxWins = 0;
      let maxPodiums = 0;
      let referenceRaceId = null;
      completedRaces.forEach((race) => {
        const row = (resultsByRace.get(race.id) || []).find((entry) => String(entry.driver_id) === driverId);
        const finish = number(row?.finish_position, null);
        winRun = finish === 1 ? winRun + 1 : 0;
        podiumRun = Number.isFinite(finish) && finish <= 3 ? podiumRun + 1 : 0;
        if (winRun > maxWins || podiumRun > maxPodiums) referenceRaceId = race.id;
        maxWins = Math.max(maxWins, winRun);
        maxPodiums = Math.max(maxPodiums, podiumRun);
      });

      const type = maxWins >= 2 && maxWins >= maxPodiums ? 'Siege' : 'Podien';
      const length = type === 'Siege' ? maxWins : maxPodiums;
      if (length < 2) return;
      if (!best || length > best.length || (length === best.length && type === 'Siege' && best.type !== 'Siege')) {
        best = { driverId, type, length, raceId: referenceRaceId || completedRaces.at(-1)?.id };
      }
    });

    if (!best) return {
      kicker: 'Serien',
      title: 'Beste Serie',
      value: 'Noch offen',
      detail: 'Noch kein Fahrer hat mindestens zwei Siege oder Podien in Folge erreicht.',
      tone: 'streak'
    };
    const name = getDriverName(best.driverId, best.raceId, resolver, driversById);
    return {
      kicker: 'Serien',
      title: 'Beste Serie',
      value: `${escapeHtml(name)} · ${best.length}×`,
      detail: `${best.length} ${best.type.toLowerCase()} in Folge – längste Serie der Saison.`,
      tone: 'streak'
    };
  }

  function renderCards(cards) {
    const host = byId('racing-insights-grid');
    const section = byId('racing-insights-section');
    if (!host || !section) return;
    const usable = cards.filter(Boolean);
    if (!usable.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    const html = usable.map((card) => `
      <article class="racing-insight-card racing-insight-card--${escapeHtml(card.tone || 'default')}">
        <div class="racing-insight-kicker">${escapeHtml(card.kicker)}</div>
        <h3>${escapeHtml(card.title)}</h3>
        <div class="racing-insight-value">${card.value}</div>
        <p>${card.detail}</p>
      </article>
    `).join('');
    host.innerHTML = html;
    saveCache(html);
  }

  async function render() {
    if (renderPromise) return renderPromise;
    renderPromise = (async () => {
      const section = byId('racing-insights-section');
      if (!section || !window.RCCData || !window.RCCDriverContext) return;

      const currentSeason = await window.RCCData.fetchCurrentSeason().catch(() => null);
      if (!currentSeason?.id) {
        section.hidden = true;
        return;
      }

      const [drivers, races, assignments] = await Promise.all([
        window.RCCData.fetchDrivers(),
        window.RCCData.fetchRaces({ seasonId: currentSeason.id }),
        window.RCCDriverContext.fetchDriverSeasonAssignments({ seasonId: currentSeason.id })
      ]);
      const raceIds = (races || []).map((race) => race.id).filter(Boolean);
      if (!raceIds.length) {
        section.hidden = true;
        return;
      }
      const raceResults = await window.RCCData.fetchRaceResults({ raceIds });
      const resultRaceIds = new Set((raceResults || []).map((row) => row.race_id));
      const completedRaces = (races || [])
        .filter((race) => lifecycleStatus(race) === 'completed' || resultRaceIds.has(race.id))
        .sort((a, b) => Number(a.round_number || 0) - Number(b.round_number || 0));
      if (!completedRaces.length || !raceResults.length) {
        section.hidden = true;
        return;
      }

      const driversById = new Map((drivers || []).map((driver) => [String(driver.id), driver]));
      const resultsByRace = groupBy(raceResults, (row) => row.race_id);
      const resolver = window.RCCDriverContext.createAssignmentResolver({ drivers, races, assignments });
      const fastestByRace = new Map();
      completedRaces.forEach((race) => {
        fastestByRace.set(race.id, window.RCCData.getFastestLapDriverId(resultsByRace.get(race.id) || []));
      });
      const standings = window.RCCData.buildStandings({ drivers, races: completedRaces, raceResults, resolver });

      renderCards([
        buildLatestGainer(completedRaces, resultsByRace, resolver, driversById),
        buildSeasonGainer(completedRaces, resultsByRace, resolver, driversById),
        buildPoleToWin(completedRaces, resultsByRace, resolver, driversById),
        buildRecentForm(completedRaces, resultsByRace, resolver, driversById, fastestByRace),
        buildTitleFight(standings),
        buildBestStreak(completedRaces, resultsByRace, resolver, driversById)
      ]);
    })().catch((error) => {
      console.error('Racing Insights konnten nicht geladen werden:', error);
      const host = byId('racing-insights-grid');
      if (host && !host.children.length) {
        host.innerHTML = '<div class="race-hub-empty">Racing Insights konnten nicht geladen werden.</div>';
      }
    }).finally(() => {
      renderPromise = null;
    });
    return renderPromise;
  }

  window.RCCRacingInsights = { render, restoreCache };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreCache, { once: true });
  } else {
    restoreCache();
  }
  document.addEventListener('dashboard:content-ready', render);
  document.addEventListener('DOMContentLoaded', () => window.setTimeout(render, 0), { once: true });
})();
