const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('assets/js/data/track-info.js', 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(code, context);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const imola = context.window.getTrackInfo('Imola');
assert(imola && imola.id === 'imola', 'Imola alias lookup failed');

const official = context.window.getTrackInfo('Autodromo Internazionale Enzo e Dino Ferrari');
assert(official && official.id === 'imola', 'Official name lookup failed');

const unknown = context.window.getTrackInfo('Unbekannte Strecke');
assert(unknown === null, 'Unknown track should return null');

const contract = context.window.formatF1Contract(2025);
assert(contract === 'bis 2025', 'Contract formatting failed');

console.log('track-info tests passed');
