const fs = require('fs');

const profile = fs.readFileSync('assets/js/pages/track-profile.js', 'utf8');
const profileHtml = fs.readFileSync('strecken-profil.html', 'utf8');
const hubHtml = fs.readFileSync('strecken.html', 'utf8');
const flagCss = fs.readFileSync('assets/css/pages/track-flags.css', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(profile.includes('createFlagBadge?.(countryCode'), 'Track profile must render its country flag');
assert(profile.includes("getFlagEmoji?.(countryCode) || '🏁'"), 'Track profile must keep an emoji fallback');
assert(profileHtml.includes('assets/css/pages/track-flags.css'), 'Track profile must load the shared flag styles');
assert(hubHtml.includes('assets/css/pages/track-flags.css'), 'Track hub must load the shared flag styles');
assert(flagCss.includes('#track-profile-country .flag-badge'), 'Track profile flag must use the compact flag presentation');

console.log('track profile flag tests passed');
