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
    keys: ['mclaren', 'mclaren f1', 'mclaren formula 1', 'mclaren formula 1 team', 'mclaren f1 team', 'mclaren mercedes'],
    name: 'McLaren',
    logoUrl: 'assets/images/team-logos/mclaren.png'
  },
  {
    keys: ['ferrari', 'scuderia ferrari', 'ferrari hp', 'scuderia ferrari hp', 'ferrari f1 team', 'scuderia ferrari mission winnow', 'ferrari mission winnow'],
    name: 'Ferrari',
    logoUrl: 'assets/images/team-logos/ferrari.png'
  },
  {
    keys: ['red bull', 'redbull', 'red bull racing', 'oracle red bull', 'oracle red bull racing', 'red bull racing honda rbpt', 'red bull honda', 'red bull racing honda', 'infiniti red bull racing'],
    name: 'Red Bull Racing',
    logoUrl: 'assets/images/team-logos/red-bull.png'
  },
  {
    keys: ['mercedes', 'mercedes amg', 'mercedes-amg', 'petronas', 'mercedes amg petronas', 'mercedes amg petronas f1 team', 'mercedes amg petronas formula one team'],
    name: 'Mercedes',
    logoUrl: 'assets/images/team-logos/mercedes.png'
  },
  {
    keys: ['aston martin', 'aston martin aramco', 'aston martin aramco formula one team', 'aston martin f1 team', 'aston martin cognizant', 'aston martin cognizant formula one team'],
    name: 'Aston Martin',
    logoUrl: 'assets/images/team-logos/aston-martin.png'
  },
  {
    // Legacy mapping: Renault-Einträge sollen bewusst auf das aktuelle Alpine-Branding zeigen.
    keys: ['alpine', 'renault', 'renault f1', 'renault f1 team', 'bwt alpine', 'bwt alpine f1 team', 'alpine f1 team'],
    name: 'Alpine',
    logoUrl: 'assets/images/team-logos/alpine.png'
  },
  {
    keys: ['haas', 'moneygram haas', 'moneygram haas f1 team', 'haas f1 team', 'uralkali haas', 'uralkali haas f1 team'],
    name: 'Haas',
    logoUrl: 'assets/images/team-logos/haas.png'
  },
  {
    // Legacy mapping: AlphaTauri/Toro Rosso sollen bewusst auf das heutige Racing-Bulls-Logo gemappt werden.
    keys: ['racing bulls', 'rb', 'rb f1', 'rb f1 team', 'rb honda rbpt', 'vcarb', 'visa cash app rb', 'visa cash app racing bulls', 'visa cash app rb f1 team', 'visa cash app racing bulls f1 team', 'alpha tauri', 'alphatauri', 'scuderia alphatauri', 'scuderia alpha tauri', 'toro rosso', 'scuderia toro rosso'],
    name: 'Racing Bulls',
    logoUrl: 'assets/images/team-logos/racing-bulls.png'
  },
  {
    keys: ['williams', 'atlassian williams', 'atlassian williams racing', 'williams racing', 'williams mercedes'],
    name: 'Williams',
    logoUrl: 'assets/images/team-logos/williams.png'
  },
  {
    // Legacy mapping: Alfa Romeo/Audi-Bezeichnungen sollen bewusst auf das Sauber-Logo zeigen.
    keys: ['sauber', 'stake', 'kick sauber', 'kick f1', 'stake f1', 'stake f1 team kick sauber', 'stake kick sauber', 'kick sauber ferrari', 'stake sauber', 'alfa romeo', 'alfa romeo racing', 'alfa romeo f1 team', 'alfa romeo racing orlen', 'audi', 'audi f1', 'audi f1 team'],
    name: 'Sauber',
    logoUrl: 'assets/images/team-logos/sauber.png'
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

function findMatchingTeamLogoName(candidates = []) {
  const names = (Array.isArray(candidates) ? candidates : [candidates])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (!names.length) return '';
  return names.find((name) => Boolean(getTeamLogoMeta(name))) || names[0];
}

function resolveDriverLogoSource(driver = {}) {
  const candidates = [
    driver.car_name,
    driver.carName,
    driver.league_team,
    driver.leagueTeam
  ];
  return findMatchingTeamLogoName(candidates)
    || candidates.map((value) => String(value || '').trim()).find(Boolean)
    || '';
}

function isDirectImageSource(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^data:image\//i.test(text)) return true;
  return /\.(png|jpe?g|webp|svg)(?:[?#].*)?$/i.test(text);
}

const TEAM_LOGO_CACHE_BUSTER = '2026-04-16-1';

function withCacheBuster(url) {
  const source = String(url || '').trim();
  if (!source || /^data:image\//i.test(source) || /^https?:\/\//i.test(source)) return source;

  const separator = source.includes('?') ? '&' : '?';
  return `${source}${separator}v=${encodeURIComponent(TEAM_LOGO_CACHE_BUSTER)}`;
}

function createTeamLogoBadge(teamName, options = {}) {
  const safeTeamName = String(teamName || '').trim() || 'Unbekanntes Team';
  const logoMeta = getTeamLogoMeta(safeTeamName);
  const sizeClass = options.size === 'large' ? ' team-logo-badge--large' : '';
  const labelSource = String(options.label || safeTeamName).trim() || safeTeamName;
  const label = escapeHtml(labelSource);

  if (isDirectImageSource(safeTeamName)) {
    return `
      <span class="team-logo-badge${sizeClass}" title="${label}" aria-label="${label}">
        <img
          src="${escapeHtml(withCacheBuster(safeTeamName))}"
          alt="${label}"
          loading="lazy"
          referrerpolicy="no-referrer"
          onerror="this.parentElement.classList.add('is-fallback'); this.remove(); this.parentElement.textContent='${label}';"
        >
      </span>
    `;
  }

  if (!logoMeta?.logoUrl) {
    return `<span class="team-logo-fallback">${label}</span>`;
  }

  const primaryLogoUrl = withCacheBuster(String(logoMeta.logoUrl || ''));
  const fallbackLogoUrl = primaryLogoUrl.match(/\.png(?:[?#].*)?$/i)
    ? primaryLogoUrl.replace(/\.png(?=([?#].*)?$)/i, '.svg')
    : primaryLogoUrl.replace(/\.svg(?=([?#].*)?$)/i, '.png');

  return `
    <span class="team-logo-badge${sizeClass}" title="${label}" aria-label="${label}">
      <img
        src="${escapeHtml(primaryLogoUrl)}"
        data-fallback-src="${escapeHtml(fallbackLogoUrl)}"
        data-fallback-used="0"
        alt="${label}"
        loading="lazy"
        referrerpolicy="no-referrer"
        onerror="if (this.dataset.fallbackUsed !== '1' && this.dataset.fallbackSrc && this.dataset.fallbackSrc !== this.src) { this.dataset.fallbackUsed = '1'; this.src = this.dataset.fallbackSrc; } else { this.parentElement.classList.add('is-fallback'); this.remove(); this.parentElement.textContent='${label}'; }"
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
  const rawTrackName = track?.circuitName || track?.grandPrixName || '';
  const cardClass = options.cardClass ? ` ${escapeHtml(options.cardClass)}` : '';

  if (!mapUrl) {
    return '<div class="track-map-placeholder">Track Map folgt</div>';
  }

  return `
    <div class="track-map-wrap${cardClass}">
      <button
        type="button"
        class="track-map-button"
        data-trackmap-open="${escapeHtml(mapUrl)}"
        data-trackmap-title="${label}"
        aria-label="Track Map von ${label} vergrößert öffnen"
        tabIndex="0"
      >
        <img class="track-map-image" src="${escapeHtml(mapUrl)}" alt="${label} Track Map" loading="lazy">
      </button>
      <button
        type="button"
        class="track-map-info-hint"
        data-trackinfo-open="${escapeHtml(rawTrackName)}"
        aria-label="Streckeninfos zu ${label} öffnen"
      >ℹ</button>
    </div>
  `;
}


function createRaceCard(race) {
  const { track } = getRaceTrackMeta(race);
  const flagBadge = createFlagBadge(track?.countryCode, `${track?.grandPrixName || race?.grand_prix_name || 'Grand Prix'} Flagge`);
  const href = `rennen-detail.html?round=${encodeURIComponent(race.round_number)}${race.season_id ? `&season=${encodeURIComponent(race.season_id)}` : ''}`;

  return `
    <a class="race-card-link" href="${href}" data-race-round="${escapeHtml(String(race.round_number || ''))}" data-race-season="${escapeHtml(String(race.season_id || ''))}">
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
window.findMatchingTeamLogoName = findMatchingTeamLogoName;
window.resolveDriverLogoSource = resolveDriverLogoSource;
window.createTeamLogoBadge = createTeamLogoBadge;
