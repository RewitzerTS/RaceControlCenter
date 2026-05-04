(function () {
  function normalizeTrackName(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[–—−-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const TRACK_INFOS = [
    {
      id: 'imola',
      aliases: [
        'Imola',
        'Autodromo Enzo e Dino Ferrari',
        'Autodromo Internazionale Enzo e Dino Ferrari',
        'Autodromo Enzo e Dino Ferrari – Imola'
      ],
      officialName: 'Autodromo Internazionale Enzo e Dino Ferrari',
      shortName: 'Imola',
      country: 'Italien',
      lengthKm: '4,909 km',
      raceDistanceKm: '309,049 km',
      laps: 63,
      firstGrandPrix: 1980,
      lapRecord: '1:15.484 – Lewis Hamilton, 2020',
      capacity: 'ca. 78.000',
      f1ContractUntil: 2025,
      corners: 19,
      drsZones: 1,
      trackType: 'Permanente Rennstrecke',
      direction: 'Gegen den Uhrzeigersinn',
      famousCorners: ['Tamburello', 'Villeneuve', 'Tosa', 'Acque Minerali', 'Rivazza']
    }
  ];

  const infoByAlias = new Map();
  TRACK_INFOS.forEach((entry) => {
    [entry.officialName, entry.shortName, ...(entry.aliases || [])].forEach((alias) => {
      const key = normalizeTrackName(alias);
      if (key) infoByAlias.set(key, entry);
    });
  });

  function getTrackInfo(trackName) {
    const key = normalizeTrackName(trackName);
    if (!key) return null;
    return infoByAlias.get(key) || null;
  }

  function formatF1Contract(contractYear) {
    if (!Number.isFinite(Number(contractYear))) return 'unbekannt';
    return `bis ${Number(contractYear)}`;
  }

  window.TRACK_INFOS = TRACK_INFOS;
  window.getTrackInfo = getTrackInfo;
  window.formatF1Contract = formatF1Contract;
  window.normalizeTrackName = normalizeTrackName;
})();
