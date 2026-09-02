const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('../v2/node_modules/jsdom');

const context = {
  window: {
    escapeHtml: (value) => String(value),
    RCCData: {
      groupBy(rows, key) {
        const grouped = new Map();
        rows.forEach((row) => grouped.set(key(row), [...(grouped.get(key(row)) || []), row]));
        return grouped;
      },
      getFastestLapDriverId: () => 'human',
      getAwardedRacePoints: (row) => row.awarded_points
    }
  },
  document: { addEventListener() {} }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('assets/js/pages/results.js', 'utf8'), context);

const drivers = [
  { id: 'human', display_name: 'Legacy Player', ai_driver_reference: 'Nico Hulkenberg' },
  { id: 'bot', display_name: 'Legacy Substitute', ai_driver_reference: 'Liam Lawson' },
  { id: 'owner', display_name: 'AI Points Owner' },
  { id: 'absent', display_name: 'No Result' }
];
const races = [{ id: 'race', status: 'completed', round_number: 1, grand_prix_name: 'Test GP' }];
const results = [
  { race_id: 'race', driver_id: 'human', participation_status: 'PLAYER', awarded_points: 25 },
  { race_id: 'race', driver_id: 'bot', participation_status: 'BOT', awarded_points: 18 },
  { race_id: 'race', driver_id: 'ai', points_owner_driver_id: 'owner', participation_status: 'BOT', awarded_points: 15 }
];
const matrix = context.buildMatrixData(drivers, races, results, null);
assert.deepEqual(Array.from(matrix.rows, (row) => row.raceCells[0].isBot), [false, true, true, false]);
assert.deepEqual(Array.from(matrix.rows, (row) => row.total), [25, 18, 15, 0]);
assert.equal(matrix.rows[0].raceCells[0].hasFastestLap, true);

const container = { innerHTML: '' };
context.renderMatrix(container, { textContent: '' }, matrix);
const dom = new JSDOM(`<div id="results-matrix-wrap">${container.innerHTML}</div>`, { runScripts: 'outside-only' });
dom.window.eval(fs.readFileSync('assets/js/pages/results-status-markers.js', 'utf8'));
dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
const renderedRows = [...dom.window.document.querySelectorAll('tbody tr')];
assert.equal(renderedRows[0].querySelectorAll('[data-result-marker="bot"]').length, 0);
assert.equal(renderedRows[0].querySelectorAll('[data-result-marker="fl"]').length, 1);
assert.equal(renderedRows[1].querySelectorAll('[data-result-marker="bot"]').length, 1);
assert.equal(renderedRows[2].querySelectorAll('[data-result-marker="bot"]').length, 1);
assert.equal(renderedRows[3].querySelectorAll('[data-result-marker]').length, 0);
dom.window.close();

const migration = '20260902195113_preserve_legacy_result_participation.sql';
assert.equal(
  fs.readFileSync(`supabase/migrations/${migration}`, 'utf8'),
  fs.readFileSync(`v2/supabase/migrations/${migration}`, 'utf8'),
  'Both migration trees must ship the same correction'
);
console.log('PLAYER/BOT matrix, fastest-lap markers, points ownership and migration parity tests passed');
