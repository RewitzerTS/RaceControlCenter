const RCC_TRACKS = [
  { key: 'australia', trackMapFile: 'australia.png', grandPrixName: 'Australien GP', circuitName: 'Melbourne Grand Prix Circuit', countryCode: 'AU', aliases: ['australien gp', 'australian gp', 'australia gp', 'melbourne gp'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M18 54 C46 28, 90 20, 124 28 C140 32, 149 42, 150 58 C151 72, 140 82, 122 84 C98 87, 84 78, 70 74 C52 68, 38 70, 18 54 Z' },
  { key: 'china', trackMapFile: 'shanghai.png', grandPrixName: 'China GP', circuitName: 'Shanghai International Circuit', countryCode: 'CN', aliases: ['china gp', 'chinese gp', 'shanghai gp'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M22 48 C36 24, 68 20, 92 28 C104 32, 112 40, 112 50 C112 60, 102 66, 84 66 L60 66 L60 84 L30 84 L30 58 C30 52, 26 50, 22 48 Z' },
  { key: 'japan', trackMapFile: 'suzuka.png', grandPrixName: 'Japan GP', circuitName: 'Suzuka International Racing Course', countryCode: 'JP', aliases: ['japan gp', 'japanese gp', 'suzuka gp'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M28 28 C54 16, 84 22, 98 40 C108 52, 110 66, 98 78 C84 92, 54 92, 38 78 C18 60, 18 42, 28 28 Z M70 30 C62 40, 62 54, 70 64 C76 72, 86 74, 96 72' },
  { key: 'bahrain', trackMapFile: 'bahrain.png', grandPrixName: 'Bahrain GP', circuitName: 'Bahrain International Circuit', countryCode: 'BH', aliases: ['bahrain gp', 'bahrain grand prix', 'sakhir gp', 'sakhir'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M20 62 C30 30, 76 18, 108 26 C128 32, 138 48, 132 64 C126 80, 106 88, 74 84 C48 80, 30 78, 20 62 Z' },
  { key: 'saudi-arabia', trackMapFile: 'jeddah.png', grandPrixName: 'Saudi-Arabien GP', circuitName: 'Jeddah Corniche Circuit', countryCode: 'SA', aliases: ['saudi arabia gp', 'saudi-arabien gp', 'saudi gp', 'jeddah gp', 'jeddah'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M34 18 C40 34, 34 48, 40 64 C46 80, 40 92, 32 98 M66 16 C58 30, 60 40, 68 52 C78 66, 78 82, 62 94 M96 14 C92 30, 100 42, 112 54 C126 68, 128 82, 114 96' },
  { key: 'miami', trackMapFile: 'miami.png', grandPrixName: 'Miami GP', circuitName: 'Miami International Autodrome', countryCode: 'US', aliases: ['miami gp', 'miami grand prix'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M20 34 L74 34 C92 34, 108 44, 108 58 C108 74, 92 82, 68 82 L46 82 C32 82, 22 76, 22 66 C22 56, 30 50, 44 50 L92 50' },
  { key: 'imola', trackMapFile: 'imola.png', grandPrixName: 'Emilia-Romagna GP', circuitName: 'Autodromo Enzo e Dino Ferrari', countryCode: 'IT', aliases: ['emilia romagna gp', 'emilia-romagna gp', 'imola gp', 'imola'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M18 66 C34 26, 94 16, 122 42 C138 58, 130 82, 104 86 C78 90, 52 80, 36 82 C24 84, 16 76, 18 66 Z' },
  { key: 'monaco', trackMapFile: 'monaco.png', grandPrixName: 'Monaco GP', circuitName: 'Circuit de Monaco', countryCode: 'MC', aliases: ['monaco gp', 'monaco grand prix'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M28 28 C46 20, 74 22, 94 34 C108 42, 112 52, 102 60 C92 68, 72 66, 64 74 C58 80, 66 92, 58 98 C48 104, 30 92, 28 78 C26 58, 16 34, 28 28 Z' },
  { key: 'canada', trackMapFile: 'montreal.png', grandPrixName: 'Kanada GP', circuitName: 'Circuit Gilles Villeneuve', countryCode: 'CA', aliases: ['kanada gp', 'canada gp', 'montreal gp', 'circuit gilles villeneuve'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M22 52 C30 30, 60 18, 92 20 C116 22, 134 36, 136 54 C138 72, 126 82, 104 82 L70 82 C42 82, 24 72, 22 52 Z' },
  { key: 'spain', trackMapFile: 'barcelona.png', grandPrixName: 'Spanien GP', circuitName: 'Circuit de Barcelona-Catalunya', countryCode: 'ES', aliases: ['spanien gp', 'spain gp', 'spanish gp', 'barcelona gp', 'barcelona-catalunya'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M20 46 C34 22, 82 18, 112 32 C126 40, 132 54, 124 66 C116 78, 96 82, 70 80 C46 78, 26 70, 20 46 Z' },
  { key: 'austria', trackMapFile: 'redbullring.png', grandPrixName: 'Österreich GP', circuitName: 'Red Bull Ring', countryCode: 'AT', aliases: ['österreich gp', 'osterreich gp', 'austria gp', 'austrian gp', 'österreich/austria gp', 'red bull ring'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M22 74 L42 28 L94 20 L132 44 L110 82 L54 90 Z' },
  { key: 'great-britain', trackMapFile: 'silverstone.png', grandPrixName: 'Großbritannien GP', circuitName: 'Silverstone Circuit', countryCode: 'GB', aliases: ['großbritannien gp', 'grossbritannien gp', 'great britain gp', 'british gp', 'silverstone gp', 'silverstone'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M20 64 C26 36, 56 18, 92 20 C122 22, 142 38, 142 58 C142 76, 124 88, 98 90 C70 92, 54 72, 34 72 C26 72, 20 68, 20 64 Z' },
  { key: 'belgium', trackMapFile: 'spa.png', grandPrixName: 'Belgien GP', circuitName: 'Circuit de Spa-Francorchamps', countryCode: 'BE', aliases: ['belgien gp', 'belgium gp', 'spa gp', 'spa-francorchamps'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M28 28 C48 18, 78 18, 104 30 C124 40, 132 58, 126 74 C120 88, 102 94, 78 90 C56 86, 44 72, 38 58 C32 46, 18 34, 28 28 Z' },
  { key: 'hungary', trackMapFile: 'hungaroring.png', grandPrixName: 'Ungarn GP', circuitName: 'Hungaroring', countryCode: 'HU', aliases: ['ungarn gp', 'hungary gp', 'hungarian gp', 'hungaroring'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M24 44 C38 22, 86 20, 112 38 C126 48, 126 64, 112 74 C96 86, 60 88, 36 76 C18 66, 14 54, 24 44 Z' },
  { key: 'netherlands', trackMapFile: 'zandvoort.png', grandPrixName: 'Niederlande GP', circuitName: 'Circuit Zandvoort', countryCode: 'NL', aliases: ['niederlande gp', 'netherlands gp', 'dutch gp', 'zandvoort gp', 'zandvoort'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M24 28 C42 18, 72 18, 94 28 C114 36, 128 54, 122 72 C114 92, 82 94, 56 84 C34 76, 18 40, 24 28 Z' },
  { key: 'italy', trackMapFile: 'monza.png', grandPrixName: 'Italien GP', circuitName: 'Autodromo Nazionale Monza', countryCode: 'IT', aliases: ['italien gp', 'italy gp', 'italian gp', 'monza gp', 'monza'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M26 20 L102 20 L136 48 L104 86 L36 86 L18 50 Z' },
  { key: 'azerbaijan', trackMapFile: 'baku.png', grandPrixName: 'Aserbaidschan GP', circuitName: 'Baku City Circuit', countryCode: 'AZ', aliases: ['aserbaidschan gp', 'azerbaijan gp', 'baku gp', 'baku city circuit'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M42 16 C36 36, 44 48, 60 56 C74 64, 78 74, 72 92 M86 16 C78 28, 82 42, 96 50 C116 62, 120 82, 104 96' },
  { key: 'singapore', trackMapFile: 'singapore.png', grandPrixName: 'Singapur GP', circuitName: 'Marina Bay Street Circuit', countryCode: 'SG', aliases: ['singapur gp', 'singapore gp', 'singapore grand prix', 'marina bay'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M26 34 C44 18, 80 18, 106 30 C124 40, 132 56, 126 72 C118 90, 88 98, 58 90 C34 84, 18 62, 26 34 Z' },
  { key: 'united-states', trackMapFile: 'cota.png', grandPrixName: 'USA GP', circuitName: 'Circuit of the Americas', countryCode: 'US', aliases: ['usa gp', 'united states gp', 'us gp', 'cota', 'circuit of the americas'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M22 78 L54 18 L80 48 L116 24 L136 62 L92 92 L62 70 Z' },
  { key: 'mexico', trackMapFile: 'mexico.png', grandPrixName: 'Mexiko GP', circuitName: 'Autódromo Hermanos Rodríguez', countryCode: 'MX', aliases: ['mexiko gp', 'mexico gp', 'mexican gp', 'hermanos rodriguez'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M24 56 C30 28, 68 16, 106 22 C130 26, 142 46, 136 66 C130 86, 102 92, 72 86 C44 80, 20 74, 24 56 Z' },
  { key: 'brazil', trackMapFile: 'interlagos.png', grandPrixName: 'São Paulo GP', circuitName: 'Autódromo José Carlos Pace', countryCode: 'BR', aliases: ['sao paulo gp', 'são paulo gp', 'brazil gp', 'brasil gp', 'interlagos'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M24 26 C48 18, 92 22, 116 40 C132 52, 132 70, 112 82 C88 96, 38 92, 24 66 C16 50, 12 32, 24 26 Z' },
  { key: 'las-vegas', trackMapFile: 'vegas.png', grandPrixName: 'Las Vegas GP', circuitName: 'Las Vegas Strip Circuit', countryCode: 'US', aliases: ['las vegas gp', 'vegas gp', 'las vegas strip circuit'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M20 30 H132 V46 H78 V62 H132 V84 H20 V66 H56 V50 H20 Z' },
  { key: 'qatar', trackMapFile: 'qatar.png', grandPrixName: 'Katar GP', circuitName: 'Lusail International Circuit', countryCode: 'QA', aliases: ['katar gp', 'qatar gp', 'lusail gp', 'lusail'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M20 58 C28 30, 68 18, 104 24 C126 28, 138 44, 136 60 C134 76, 120 88, 98 90 C72 92, 38 84, 24 72 C18 68, 16 62, 20 58 Z' },
  { key: 'abu-dhabi', trackMapFile: 'abudhabi.png', grandPrixName: 'Abu Dhabi GP', circuitName: 'Yas Marina Circuit', countryCode: 'AE', aliases: ['abu dhabi gp', 'yas marina', 'yas marina gp'], weatherPresets: ['klar', 'regen', 'dynamisch'], svgPath: 'M18 44 C30 20, 66 18, 98 28 C122 36, 138 52, 136 68 C134 86, 116 96, 88 92 C62 88, 44 72, 30 72 C18 72, 12 58, 18 44 Z' }
];

const RCC_WEATHER_OPTIONS = ['klar', 'regen', 'dynamisch'];

function normalizeTrackKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findTrackByGrandPrixName(name) {
  const needle = normalizeTrackKey(name);
  if (!needle) return null;

  return RCC_TRACKS.find((track) => {
    const names = [track.grandPrixName, ...(track.aliases || [])];
    return names.some((entry) => normalizeTrackKey(entry) === needle || normalizeTrackKey(entry).includes(needle) || needle.includes(normalizeTrackKey(entry)));
  }) || null;
}

function findTrackByCircuitName(name) {
  const needle = normalizeTrackKey(name);
  if (!needle) return null;

  return RCC_TRACKS.find((track) => {
    const circuit = normalizeTrackKey(track.circuitName);
    return circuit === needle || circuit.includes(needle) || needle.includes(circuit);
  }) || null;
}

function findTrackByRace(race) {
  return findTrackByGrandPrixName(race?.grand_prix_name) || findTrackByCircuitName(race?.circuit_name) || null;
}

function getFlagEmoji(countryCode) {
  const upper = String(countryCode || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '🏁';
  return [...upper].map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join('');
}

function getFlagImageUrl(countryCode) {
  const lower = String(countryCode || '').toLowerCase();
  if (!/^[a-z]{2}$/.test(lower)) return '';
  return `https://flagcdn.com/h40/${lower}.png`;
}

window.RCC_TRACKS = RCC_TRACKS;
window.RCC_WEATHER_OPTIONS = RCC_WEATHER_OPTIONS;
window.findTrackByGrandPrixName = findTrackByGrandPrixName;
window.findTrackByCircuitName = findTrackByCircuitName;
window.findTrackByRace = findTrackByRace;
window.getFlagEmoji = getFlagEmoji;
window.getFlagImageUrl = getFlagImageUrl;
