const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('assets/js/pages/results.js', 'utf8');
const context = {
  window: {},
  document: { addEventListener() {} },
  CustomEvent: function CustomEvent() {}
};

vm.createContext(context);
vm.runInContext(code, context);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const utils = context.window.RCCResultsFocusUtils;
const rows = Array.from({ length: 8 }, (_, index) => ({
  driver: { id: `driver-${index + 1}`, display_name: `Driver ${index + 1}` }
}));

const desktopLeaders = utils.selectTrendFocusKeys(rows, {
  mode: 'leaders',
  ownDriverId: 'driver-8',
  compact: false
});
assert(desktopLeaders.join(',') === 'driver-1,driver-2,driver-3,driver-4,driver-5,driver-8', 'Desktop should show Top 5 plus own driver');

const mobileLeaders = utils.selectTrendFocusKeys(rows, {
  mode: 'leaders',
  ownDriverId: 'driver-8',
  compact: true
});
assert(mobileLeaders.join(',') === 'driver-1,driver-2,driver-3,driver-8', 'Mobile should show Top 3 plus own driver');

const ownOnly = utils.selectTrendFocusKeys(rows, { mode: 'own', ownDriverId: 'driver-8' });
assert(ownOnly.join(',') === 'driver-8', 'Own-driver mode should show only the linked driver');

const comparison = utils.selectTrendFocusKeys(rows, {
  mode: 'compare',
  ownDriverId: 'driver-8',
  compareKeys: ['driver-2', 'driver-3', 'driver-2']
});
assert(comparison.join(',') === 'driver-8,driver-2,driver-3', 'Comparison should show own driver plus at most two unique competitors');

console.log('results focus tests passed');
