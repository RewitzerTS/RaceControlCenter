const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('assets/js/data/tracks.js', 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(code, context);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const f1_25Tracks = context.window.getTracksForSeasonGame('f1_25');
const f1_26Tracks = context.window.getTracksForSeasonGame('f1_26');

assert(f1_25Tracks.length === 24, 'F1 25 should expose 24 calendar tracks');
assert(f1_26Tracks.length === 24, 'F1 26 should expose 24 calendar tracks');
assert(f1_25Tracks.some((track) => track.key === 'spain' && track.grandPrixName === 'Spanien GP'), 'F1 25 should keep Barcelona as Spanien GP');
assert(!f1_25Tracks.some((track) => track.key === 'madrid'), 'F1 25 should not include Madrid');
assert(f1_26Tracks.some((track) => track.key === 'madrid' && track.grandPrixName === 'Spanien GP'), 'F1 26 should label Madrid as Spanien GP');
assert(f1_26Tracks.some((track) => track.key === 'catalonia' && track.grandPrixName === 'Katalonien GP'), 'F1 26 should include Barcelona as Katalonien GP');
assert(!f1_26Tracks.some((track) => track.key === 'spain'), 'F1 26 should not include the legacy Spain GP Barcelona entry');

const madridByGermanOfficial = context.window.findTrackByGrandPrixName('Grand Prix von Spanien');
assert(madridByGermanOfficial && madridByGermanOfficial.key === 'madrid', 'Grand Prix von Spanien should resolve to Madrid');

const catalonia = context.window.findTrackByGrandPrixName('Katalonien GP');
assert(catalonia && catalonia.key === 'catalonia', 'Katalonien GP should resolve to Barcelona-Catalunya');

const f1_26BarcelonaAlias = context.window.findTrackByGrandPrixName('Barcelona GP', 'f1_26');
assert(f1_26BarcelonaAlias && f1_26BarcelonaAlias.key === 'catalonia', 'Barcelona GP should resolve to Catalonia for F1 26 imports');

const f1_25BarcelonaAlias = context.window.findTrackByGrandPrixName('Barcelona GP', 'f1_25');
assert(f1_25BarcelonaAlias && f1_25BarcelonaAlias.key === 'spain', 'Barcelona GP should resolve to Spain for F1 25 imports');

console.log('tracks tests passed');
