(() => {
  let initialized = false;

  function getScoring() {
    const settings = window.RCCLeagueContext?.snapshot?.()?.league?.settings || {};
    const scoring = settings.scoring || {};
    const points = Array.isArray(scoring.points)
      ? scoring.points.map(Number).filter((value) => Number.isFinite(value) && value >= 0)
      : [];
    return {
      points: points.length ? points : [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      fastestLapBonus: Math.max(0, Number(scoring.fastest_lap_bonus ?? 1) || 0),
      fastestLapTopN: Math.max(0, Number(scoring.fastest_lap_top_n ?? 10) || 0)
    };
  }

  function install() {
    const originalAwarded = window.getAwardedRacePoints;

    window.getBasePointsForPosition = (position) => {
      const pos = Number(position);
      if (!Number.isFinite(pos) || pos < 1) return 0;
      return getScoring().points[Math.floor(pos) - 1] || 0;
    };

    window.getAwardedRacePoints = (row, fastestLapDriverId = null) => {
      const storedPoints = Number(row?.awarded_points);
      if (Number.isFinite(storedPoints)) return storedPoints;
      if (!row) return typeof originalAwarded === 'function' ? originalAwarded(row, fastestLapDriverId) : 0;

      const position = Number(row.finish_position);
      const scoring = getScoring();
      const basePoints = window.getBasePointsForPosition(position);
      const eligibleForBonus = scoring.fastestLapTopN === 0
        || (Number.isFinite(position) && position >= 1 && position <= scoring.fastestLapTopN);
      const hasFastestLapBonus = Boolean(
        fastestLapDriverId
        && row.driver_id === fastestLapDriverId
        && eligibleForBonus
      );
      return basePoints + (hasFastestLapBonus ? scoring.fastestLapBonus : 0);
    };
  }

  function loadResultConsistency() {
    if (window.RCCResultsConsistency) return window.RCCResultsConsistency.init?.();
    if (document.querySelector('script[data-rcc-results-consistency]')) return;
    const script = document.createElement('script');
    script.src = 'assets/js/pages/admin-results-consistency.js';
    script.dataset.rccResultsConsistency = 'true';
    script.onload = () => window.RCCResultsConsistency?.init?.();
    script.onerror = () => console.warn('Ergebnis-Sicherheitsmodul konnte nicht geladen werden.');
    document.head.appendChild(script);
  }

  async function init() {
    if (initialized) return;
    await window.RCCData?.getLeagueContext?.({ forceRefresh: true }).catch(() => null);
    install();
    loadResultConsistency();
    initialized = true;
  }

  window.RCCLeagueScoring = { init, getScoring, install };
})();
