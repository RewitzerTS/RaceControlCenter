const fs = require('fs');

const trackHub = fs.readFileSync('assets/js/pages/track-hub.js', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  trackHub.includes('createTrackMapSvg?.(track.track)'),
  'Track hub cards must use the global info-button-free track map component'
);
assert(!trackHub.includes('showInfo'), 'Track hub cards must not retain a local info-button override');
assert(!trackHub.includes('track-hub-kpis'), 'Track hub cards must not render KPI chips');
assert(!trackHub.includes('Rekordsieger:'), 'Track hub cards must not render record winner chips');
assert(!trackHub.includes('Bestzeit:'), 'Track hub cards must not render best-time chips');
assert(trackHub.includes('createFlagBadge?.(track.track?.countryCode'), 'Track hub cards must render the local country flag');

console.log('track hub UI tests passed');
