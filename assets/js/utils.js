function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const TEAM_LOGO_MAP = [
  {
    keys: ['mclaren', 'mclaren f1', 'mclaren formula 1'],
    name: 'McLaren',
    logoUrl: 'assets/images/team-logos/mclaren.svg'
  },
  {
    keys: ['ferrari', 'scuderia ferrari', 'ferrari hp'],
    name: 'Ferrari',
    logoUrl: 'assets/images/team-logos/ferrari.svg'
  },
  {
    keys: ['red bull', 'redbull', 'red bull racing', 'oracle red bull'],
    name: 'Red Bull Racing',
    logoUrl: 'assets/images/team-logos/red-bull.svg'
  },
  {
    keys: ['mercedes', 'mercedes amg', 'mercedes-amg', 'petronas'],
    name: 'Mercedes',
    logoUrl: 'assets/images/team-logos/mercedes.svg'
  },
  {
    keys: ['aston martin', 'aston martin aramco'],
    name: 'Aston Martin',
    logoUrl: 'assets/images/team-logos/aston-martin.svg'
  },
  {
    keys: ['alpine', 'renault', 'bwt alpine'],
    name: 'Alpine',
    logoUrl: 'assets/images/team-logos/alpine.svg'
  },
  {
    keys: ['haas', 'moneygram haas'],
    name: 'Haas',
    logoUrl: 'assets/images/team-logos/haas.svg'
  },
  {
    keys: ['racing bulls', 'rb', 'rb f1', 'vcarb', 'visa cash app rb', 'visa cash app racing bulls', 'alpha tauri', 'alphatauri', 'toro rosso'],
    name: 'Racing Bulls',
    logoUrl: 'assets/images/team-logos/racing-bulls.svg'
  },
  {
    keys: ['williams', 'atlassian williams'],
    name: 'Williams',
    logoUrl: 'assets/images/team-logos/williams.svg'
  },
  {
    keys: ['sauber', 'stake', 'kick sauber', 'kick f1', 'stake f1', 'alfa romeo'],
    name: 'Sauber',
    logoUrl: 'assets/images/team-logos/sauber.svg'
  }
];

function normalizeTeamName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getTeamLogoMeta(teamName) {
  const normalizedTeam = normalizeTeamName(teamName);
  if (!normalizedTeam) return null;

  return TEAM_LOGO_MAP.find((entry) =>
    entry.keys.some((key) => normalizedTeam.includes(normalizeTeamName(key)))
  ) || null;
}

function createTeamLogoBadge(teamName, options = {}) {
  const safeTeamName = String(teamName || '').trim() || 'Unbekanntes Team';
  const logoMeta = getTeamLogoMeta(safeTeamName);
  const sizeClass = options.size === 'large' ? ' team-logo-badge--large' : '';
  const label = escapeHtml(safeTeamName);

  if (!logoMeta?.logoUrl) {
    return `<span class="team-logo-fallback">${label}</span>`;
  }

  return `
    <span class="team-logo-badge${sizeClass}" title="${label}" aria-label="${label}">
      <img
        src="${escapeHtml(logoMeta.logoUrl)}"
        alt="${label}"
        loading="lazy"
        referrerpolicy="no-referrer"
        onerror="this.parentElement.classList.add('is-fallback'); this.remove(); this.parentElement.textContent='${label}';"
      >
    </span>
  `;
}

function parseRaceDateValue(value, explicitTime = '') {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  let rawValue = value;
  let timeValue = explicitTime;

  if (typeof value === 'object' && value !== null) {
    rawValue = value.race_date || value.date || '';
    timeValue = explicitTime || value.race_time || '';
  }

  const text = String(rawValue).trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const safeTime = /^\d{2}:\d{2}$/.test(String(timeValue || '').trim()) ? String(timeValue).trim() : '00:00';
    const date = new Date(`${text}T${safeTime}:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const normalized = text.includes('T') ? text : `${text}T00:00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRaceDate(value) {
  const date = parseRaceDateValue(value);
  if (!date) return 'Datum folgt';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(date);
}

function formatRaceDateTime(value, explicitTime = '') {
  const date = parseRaceDateValue(value, explicitTime);
  if (!date) return 'Termin folgt';
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function toRaceInputDate(value) {
  const date = parseRaceDateValue(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatStatusLabel(status) {
  return status === 'completed' ? 'Gefahren' : 'Anstehend';
}

function getRaceLifecycleStatus(race, now = new Date()) {
  if (!race) return 'upcoming';
  if (race.status === 'completed') return 'completed';
  if (race.status !== 'upcoming') return race.status || 'upcoming';

  const scheduledStart = parseRaceDateValue(race, race.race_time);
  if (!scheduledStart) return race.status;
  return scheduledStart.getTime() <= now.getTime() ? 'completed' : 'upcoming';
}

function formatWeatherLabel(weather) {
  if (!weather) return 'offen';
  return String(weather).charAt(0).toUpperCase() + String(weather).slice(1);
}


function getRaceTrackMeta(race) {
  const track = window.findTrackByRace?.(race) || window.findTrackByGrandPrixName?.(race?.grand_prix_name) || null;
  const trackMapUrl = track?.trackMapFile ? `assets/trackmaps/${track.trackMapFile}` : '';
  return {
    flagEmoji: window.getFlagEmoji?.(track?.countryCode) || '🏁',
    flagUrl: window.getFlagImageUrl?.(track?.countryCode) || '',
    trackMapUrl,
    track
  };
}



function createFlagBadge(countryCode, label = 'Flagge') {
  const flagUrl = window.getFlagImageUrl?.(countryCode);
  const emoji = window.getFlagEmoji?.(countryCode) || '🏁';

  if (!flagUrl) {
    return `
      <span class="flag-badge flag-badge-fallback" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
        <span class="flag-fallback-emoji" aria-hidden="true">${emoji}</span>
      </span>
    `;
  }

  return `
    <span class="flag-badge" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
      <img
        src="${escapeHtml(flagUrl)}"
        alt="${escapeHtml(label)}"
        loading="lazy"
        width="24"
        height="18"
        referrerpolicy="no-referrer"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
      >
      <span class="flag-fallback-emoji" aria-hidden="true" style="display:none">${emoji}</span>
    </span>
  `;
}



function createTrackMapSvg(track, options = {}) {
  const mapFile = track?.trackMapFile;
  const mapUrl = mapFile ? `assets/trackmaps/${mapFile}` : '';
  const label = escapeHtml(track?.circuitName || track?.grandPrixName || 'Track Map');
  const cardClass = options.cardClass ? ` ${escapeHtml(options.cardClass)}` : '';

  if (!mapUrl) {
    return '<div class="track-map-placeholder">Track Map folgt</div>';
  }

  return `
    <button
      type="button"
      class="track-map-button${cardClass}"
      data-trackmap-open="${escapeHtml(mapUrl)}"
      data-trackmap-title="${label}"
      aria-label="Track Map von ${label} vergrößern"
    >
      <img class="track-map-image" src="${escapeHtml(mapUrl)}" alt="${label} Track Map" loading="lazy">
    </button>
  `;
}


function createRaceCard(race) {
  const { track } = getRaceTrackMeta(race);
  const flagBadge = createFlagBadge(track?.countryCode, `${track?.grandPrixName || race?.grand_prix_name || 'Grand Prix'} Flagge`);
  const href = `rennen-detail.html?round=${encodeURIComponent(race.round_number)}${race.season_id ? `&season=${encodeURIComponent(race.season_id)}` : ''}`;

  return `
    <a class="race-card-link" href="${href}">
      <article class="race-card">
        <div class="race-top">
          <div>
            <div class="race-round">${flagBadge}<span>Runde ${escapeHtml(race.round_number)}</span></div>
            <h3 class="race-name">${escapeHtml(race.grand_prix_name || 'Grand Prix')}</h3>
          </div>
          <span class="status-pill ${race.status === 'completed' ? 'done' : 'upcoming'}">
            ${formatStatusLabel(race.status)}
          </span>
        </div>

        <div class="race-body modern-race-body">
          <div class="race-meta-grid">
            <div class="race-meta-stack">
              <div class="race-meta">${formatRaceDateTime(race)}</div>
              <div class="race-meta-sub">${escapeHtml(race.circuit_name || track?.circuitName || 'Strecke offen')}</div>
              <div class="race-result">Wetter: <strong>${escapeHtml(formatWeatherLabel(race.weather))}</strong></div>
              ${race.steward_count
    ? `<div class="race-result">Steward: <strong>${escapeHtml(String(race.steward_count))} ${race.steward_count === 1 ? 'Fall' : 'Fälle'}</strong></div>`
    : ''}
            </div>
            <div class="track-map-card">
              ${createTrackMapSvg(track)}
            </div>
          </div>
        </div>
      </article>
    </a>
  `;
}


function parseTimeFieldToMs(value) {
  if (window.RCCData?.parseLapTimeToMs) {
    return window.RCCData.parseLapTimeToMs(value);
  }

  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;

  const normalized = text.replace(',', '.');
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    return Math.round(Number(normalized) * 1000);
  }

  const parts = normalized.split(':');
  if (!parts.length) return null;

  let totalSeconds = 0;
  let multiplier = 1;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = Number(parts[i]);
    if (!Number.isFinite(part)) return null;
    totalSeconds += part * multiplier;
    multiplier *= 60;
  }

  return Math.round(totalSeconds * 1000);
}

function createLeaderCard(entry, index, type = 'driver') {
  const podiumClass = index < 3 ? `podium-${index + 1}` : '';
  const subtitle = type === 'team'
    ? `${escapeHtml(entry.driver1 || '—')} / ${escapeHtml(entry.driver2 || '—')}`
    : `${escapeHtml(entry.leagueTeam || 'Ohne Team')} · ${escapeHtml(entry.carName || '—')}`;
  const title = type === 'team' ? entry.teamName : entry.driverName;

  return `
    <article class="leader-card ${podiumClass}">
      <div class="leader-rank number-box ${podiumClass}">${index + 1}</div>
      <div class="leader-copy">
        <h4>${escapeHtml(title)}</h4>
        <p>${subtitle}</p>
      </div>
      <div class="leader-points">${escapeHtml(entry.points)} P</div>
    </article>
  `;
}

window.escapeHtml = escapeHtml;
window.parseRaceDateValue = parseRaceDateValue;
window.formatRaceDate = formatRaceDate;
window.formatRaceDateTime = formatRaceDateTime;
window.toRaceInputDate = toRaceInputDate;
window.formatStatusLabel = formatStatusLabel;
window.getRaceLifecycleStatus = getRaceLifecycleStatus;
window.formatWeatherLabel = formatWeatherLabel;
window.parseTimeFieldToMs = parseTimeFieldToMs;
window.createRaceCard = createRaceCard;
window.getRaceTrackMeta = getRaceTrackMeta;
window.createTrackMapSvg = createTrackMapSvg;
window.createFlagBadge = createFlagBadge;
window.createLeaderCard = createLeaderCard;
window.getTeamLogoMeta = getTeamLogoMeta;
window.createTeamLogoBadge = createTeamLogoBadge;
