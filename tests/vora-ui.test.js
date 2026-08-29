const fs = require('fs');

const page = fs.readFileSync('v2/src/vora/VoraPage.tsx', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!page.includes('vora-source'), 'Vora page must not render the insight source panel');
assert(!page.includes('vora-context'), 'Vora page must not render the controlled-context panel');
assert(!page.includes('vora-recent'), 'Vora page must not render the latest-signal panel');
assert(page.includes('vora-insight'), 'Vora page must keep the primary insight');
assert(page.includes('selectVoraCatalogInsight(snapshot)'), 'Vora page must select its copy from the deterministic language catalog');
assert(page.includes('catalogInsight.focus'), 'Vora page must show the catalog focus line');
assert(page.includes('vora-racing-line'), 'Vora page must keep the career metrics');

console.log('Vora UI tests passed');
