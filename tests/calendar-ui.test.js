const fs = require('fs');
const vm = require('vm');

const utilsCode = fs.readFileSync('assets/js/utils.js', 'utf8');
const tracksCode = fs.readFileSync('assets/js/data/tracks.js', 'utf8');
const calendarCss = fs.readFileSync('assets/css/rcc-ux-pass2.css', 'utf8');
const context = { window: {} };

vm.createContext(context);
vm.runInContext(tracksCode, context);
vm.runInContext(utilsCode, context);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const italyFlag = context.window.createFlagBadge('IT', 'Italien Flagge');
assert(italyFlag.includes('assets/images/flags/it.svg'), 'Calendar flag should use the local Italian flag asset');
assert(italyFlag.includes('<img'), 'Calendar flag should render as an image on every platform');
assert(!italyFlag.includes('flagcdn'), 'Calendar flag should not reference FlagCDN');

const countryCodes = [...new Set(context.window.RCC_TRACKS.map((track) => track.countryCode))];
countryCodes.forEach((countryCode) => {
  const flagPath = context.window.getFlagImageUrl(countryCode);
  assert(flagPath.startsWith('assets/images/flags/'), `${countryCode} should resolve to a local flag asset`);
  assert(fs.existsSync(flagPath), `${countryCode} flag asset should exist`);
  assert(fs.readFileSync(flagPath, 'utf8').startsWith('<svg'), `${countryCode} flag asset should be an SVG`);
});

const imola = context.window.findTrackByGrandPrixName('Emilia-Romagna GP');
const calendarMap = context.window.createTrackMapSvg(imola, { showInfo: false });
assert(!calendarMap.includes('track-map-info-hint'), 'Calendar track map should not render an info button');

const detailMap = context.window.createTrackMapSvg(imola);
assert(detailMap.includes('track-map-info-hint'), 'Track details may keep the dedicated info button');

assert(
  /body\[data-page="kalender"\] \.calendar-toggle-row\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(calendarCss),
  'Mobile calendar controls should use a compact two-column grid'
);

console.log('calendar UI tests passed');
