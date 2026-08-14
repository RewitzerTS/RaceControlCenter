(() => {
  if (!window.RCCData?.getAwardedRacePoints) return;

  const legacyCalculator = window.RCCData.getAwardedRacePoints.bind(window.RCCData);

  window.RCCData.getAwardedRacePoints = function getFinalRacePoints(row, fastestLapDriverId = null) {
    const stored = Number(row?.awarded_points);
    if (Number.isFinite(stored)) return stored;
    return legacyCalculator(row, fastestLapDriverId);
  };
})();