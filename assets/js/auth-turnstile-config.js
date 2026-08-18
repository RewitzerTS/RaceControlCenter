// Public RaceVora auth-bot-protection configuration.
// The Turnstile site key is public by design. Never place the Turnstile secret key here.
window.RACEVORA_TURNSTILE_SITE_KEY = window.RACEVORA_TURNSTILE_SITE_KEY || '0x4AAAAAAETIVWWbQKe_2CaL';

// Temporary operational switch. Keep login/session flows active while preventing
// RaceVora flows that would consume the transactional email quota.
window.RACEVORA_EMAIL_SENDING_PAUSED = true;
window.RACEVORA_EMAIL_PAUSE_MESSAGE = 'Der RaceVora-E-Mail-Versand ist vorübergehend pausiert. Registrierung, Bestätigungs-E-Mails und Passwort-Reset sind aktuell deaktiviert. Bitte versuche es später erneut.';
