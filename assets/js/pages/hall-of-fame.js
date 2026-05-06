function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatSeasonLabel(name, fallbackIndex = null) {
  const raw = String(name || '').trim();
  if (!raw && fallbackIndex != null) return `Saison ${fallbackIndex + 1}`;
  if (!raw) return 'Saison';
  if (/^saison\s+/i.test(raw)) return raw;
  return `Saison ${raw}`;
}

function getSeasonSortValue(name, fallbackIndex = null) {
  const raw = String(name || '').trim();
  const match = raw.match(/(\d+)/);
  if (match) return Number(match[1]);
  return fallbackIndex != null ? fallbackIndex + 1 : Number.MIN_SAFE_INTEGER;
}

function isCompleteChampionRecord(record) {
  return Boolean(String(record?.driver_champion || '').trim() && String(record?.constructor_champion || '').trim());
}

function parseChampionLineup(lineup) {
  return String(lineup || '')
    .split('&')
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^([^()]+?)(?:\s*\(([^)]+)\))?$/);
      return {
        driverName: match ? String(match[1] || '').trim() : entry,
        aiDriver: match ? String(match[2] || '').trim() : ''
      };
    })
    .filter((entry) => entry.driverName);
}

function buildPersonTotals(records) {
  const totals = new Map();
  records.forEach((record) => {
    const driverName = String(record.driver_champion || '').trim();
    if (driverName) {
      if (!totals.has(driverName)) totals.set(driverName, { driver: 0, constructor: 0 });
      totals.get(driverName).driver += 1;
    }
    parseChampionLineup(record.constructor_champion_lineup).forEach((entry) => {
      if (!totals.has(entry.driverName)) totals.set(entry.driverName, { driver: 0, constructor: 0 });
      totals.get(entry.driverName).constructor += 1;
    });
  });
  return [...totals.entries()].map(([name, data]) => ({ name, ...data, total: data.driver + data.constructor }))
    .sort((a, b) => b.total - a.total || b.driver - a.driver || a.name.localeCompare(b.name, 'de'));
}

function buildConstructorTotals(records) {
  const totals = new Map();
  records.forEach((record) => {
    const constructorName = String(record.constructor_champion || '').trim();
    if (constructorName) totals.set(constructorName, (totals.get(constructorName) || 0) + 1);
  });
  return [...totals.entries()].map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'de'));
}

const HOF_IMAGE_META = Object.freeze({
  star: { src: 'assets/images/Stern.png', width: 2048, height: 1365 },
  helmet: { src: 'assets/icons/fahrer_wm_helmet.png', width: 71, height: 70 },
  trophy: { src: 'assets/icons/hall_of_fame_trophy.png', width: 79, height: 73 }
});

function renderOptimizedImage({
  src,
  alt = '',
  className = '',
  width,
  height,
  loading = 'lazy',
  decoding = 'async',
  fetchpriority = 'low',
  ariaHidden = false
}) {
  const safeClass = className ? ` class="${className}"` : '';
  const safeAlt = escapeHtml(alt);
  const hiddenAttr = ariaHidden ? ' aria-hidden="true"' : '';
  return `<img src="${src}" alt="${safeAlt}"${safeClass} width="${width}" height="${height}" loading="${loading}" decoding="${decoding}" fetchpriority="${fetchpriority}"${hiddenAttr}>`;
}

function renderCurrentFeature(record, sourceLabel = '') {
  const root = document.getElementById('hof-current-feature');
  const subtitle = document.getElementById('hof-current-subtitle');
  if (!root || !subtitle) return;
  if (!record) {
    subtitle.textContent = 'Noch kein Eintrag vorhanden';
    root.className = 'hof-empty';
    root.textContent = 'Noch keine Hall of Fame Einträge vorhanden.';
    return;
  }
  subtitle.textContent = `${formatSeasonLabel(record.season_name)}${sourceLabel ? ` · ${sourceLabel}` : ''}`;
  root.className = 'hof-season-card hof-season-card--featured';
  root.innerHTML = `
    <div class="hof-season-header">
      ${renderOptimizedImage({
    ...HOF_IMAGE_META.star,
    className: 'hof-star hof-star--left',
    loading: 'eager',
    fetchpriority: 'high',
    ariaHidden: true
  })}
      <div>
        <div class="hof-season-eyebrow">Amtierende Champions</div>
        <h2 class="hof-season-title">${escapeHtml(formatSeasonLabel(record.season_name))}</h2>
      </div>
      ${renderOptimizedImage({
    ...HOF_IMAGE_META.star,
    className: 'hof-star hof-star--right',
    loading: 'eager',
    fetchpriority: 'high',
    ariaHidden: true
  })}
    </div>
    <div class="hof-season-grid">
      <article class="hof-champion-card hof-champion-card--driver">
        <div class="hof-medal-glow"></div>
        ${renderOptimizedImage({
    ...HOF_IMAGE_META.helmet,
    alt: 'Fahrer Weltmeister',
    className: 'hof-champion-image',
    loading: 'eager',
    fetchpriority: 'high'
  })}
        <div class="hof-champion-meta">Fahrer-Weltmeister</div>
        <div class="hof-champion-name">${escapeHtml(record.driver_champion || '—')}</div>
        <div class="hof-support-pill">Team des Champions</div>
        <div class="hof-support-text">${escapeHtml(record.driver_champion_team || '—')}</div>
      </article>
      <article class="hof-champion-card hof-champion-card--constructor">
        <div class="hof-medal-glow"></div>
        ${renderOptimizedImage({
    ...HOF_IMAGE_META.trophy,
    alt: 'Konstrukteurs Weltmeister',
    className: 'hof-champion-image',
    loading: 'eager',
    fetchpriority: 'high'
  })}
        <div class="hof-champion-meta">Konstrukteurs-Weltmeister</div>
        <div class="hof-champion-name">${escapeHtml(record.constructor_champion || '—')}</div>
        <div class="hof-support-pill">Weltmeister-Lineup</div>
        <div class="hof-support-text hof-support-text--lineup">${escapeHtml(record.constructor_champion_lineup || '—')}</div>
      </article>
    </div>`;
  attachChampionConfetti(root);
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function attachChampionConfetti(featureRoot) {
  if (!featureRoot) return;
  featureRoot.setAttribute('role', 'button');
  featureRoot.setAttribute('tabindex', '0');
  featureRoot.setAttribute('aria-label', 'Amtierende Weltmeister feiern');
  featureRoot.classList.add('hof-feature-interactive');
  const trigger = () => startGoldenConfetti(5000);
  featureRoot.addEventListener('click', trigger);
  featureRoot.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    trigger();
  });
}

let confettiTimer = null;
let confettiCleanupTimer = null;
let confettiHost = null;
let confettiCounter = 0;

function startGoldenConfetti(durationMs = 5000) {
  if (prefersReducedMotion()) return;
  if (!document.body) return;
  if (!confettiHost) {
    confettiHost = document.createElement('div');
    confettiHost.className = 'hof-confetti-layer';
    document.body.appendChild(confettiHost);
  }

  window.clearInterval(confettiTimer);
  window.clearTimeout(confettiCleanupTimer);

  confettiHost.classList.add('is-visible');
  confettiTimer = window.setInterval(() => spawnGoldenConfetti(confettiHost), 140);
  spawnGoldenConfetti(confettiHost);

  confettiCleanupTimer = window.setTimeout(() => {
    window.clearInterval(confettiTimer);
    confettiTimer = null;
    confettiHost.classList.remove('is-visible');
    window.setTimeout(() => {
      if (confettiHost) confettiHost.innerHTML = '';
    }, 900);
  }, durationMs);
}

function spawnGoldenConfetti(host) {
  const burstSize = 9;
  for (let i = 0; i < burstSize; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'hof-confetti-piece';
    const size = 6 + Math.random() * 8;
    const left = Math.random() * 100;
    const drift = -90 + Math.random() * 180;
    const duration = 2.2 + Math.random() * 1.6;
    const delay = Math.random() * 0.4;
    const opacity = 0.62 + Math.random() * 0.38;
    const hue = 41 + Math.floor(Math.random() * 12);
    piece.style.width = `${size}px`;
    piece.style.height = `${Math.max(5, size * 0.62)}px`;
    piece.style.left = `${left}%`;
    piece.style.opacity = opacity.toFixed(2);
    piece.style.background = `hsl(${hue} 98% 62%)`;
    piece.style.setProperty('--hof-confetti-drift', `${drift.toFixed(1)}px`);
    piece.style.animationDuration = `${duration.toFixed(2)}s`;
    piece.style.animationDelay = `${delay.toFixed(2)}s`;
    piece.style.transform = `translate3d(0, -22px, 0) rotate(${Math.random() * 360}deg)`;
    piece.dataset.id = String(confettiCounter++);
    host.appendChild(piece);
    window.setTimeout(() => piece.remove(), (duration + delay + 0.35) * 1000);
  }
}

function renderHistoryCard(record, index) {
  return `
    <section class="hof-season-card">
      <div class="hof-season-header">
        ${renderOptimizedImage({
    ...HOF_IMAGE_META.star,
    className: 'hof-star hof-star--left',
    ariaHidden: true
  })}
        <div>
          <div class="hof-season-eyebrow">Hall of Fame</div>
          <h2 class="hof-season-title">${escapeHtml(formatSeasonLabel(record.season_name, index))}</h2>
        </div>
        ${renderOptimizedImage({
    ...HOF_IMAGE_META.star,
    className: 'hof-star hof-star--right',
    ariaHidden: true
  })}
      </div>
      <div class="hof-season-grid">
        <article class="hof-champion-card hof-champion-card--driver">
          <div class="hof-medal-glow"></div>
          ${renderOptimizedImage({
    ...HOF_IMAGE_META.helmet,
    alt: 'Fahrer Weltmeister',
    className: 'hof-champion-image'
  })}
          <div class="hof-champion-meta">Fahrer-Weltmeister</div>
          <div class="hof-champion-name">${escapeHtml(record.driver_champion || '—')}</div>
          <div class="hof-support-pill">Team des Champions</div>
          <div class="hof-support-text">${escapeHtml(record.driver_champion_team || '—')}</div>
        </article>
        <article class="hof-champion-card hof-champion-card--constructor">
          <div class="hof-medal-glow"></div>
          ${renderOptimizedImage({
    ...HOF_IMAGE_META.trophy,
    alt: 'Konstrukteurs Weltmeister',
    className: 'hof-champion-image'
  })}
          <div class="hof-champion-meta">Konstrukteurs-Weltmeister</div>
          <div class="hof-champion-name">${escapeHtml(record.constructor_champion || '—')}</div>
          <div class="hof-support-pill">Weltmeister-Lineup</div>
          <div class="hof-support-text hof-support-text--lineup">${escapeHtml(record.constructor_champion_lineup || '—')}</div>
        </article>
      </div>
    </section>`;
}

function renderHistory(records) {
  const recentRoot = document.getElementById('hof-recent-wall');
  const archiveRoot = document.getElementById('hof-archive-wall');
  const archiveSection = document.getElementById('hof-archive-section');
  if (!recentRoot || !archiveRoot || !archiveSection) return;
  if (!records.length) {
    recentRoot.innerHTML = '<div class="hof-empty">Noch keine Weltmeister-Historie vorhanden.</div>';
    archiveRoot.innerHTML = '';
    archiveSection.hidden = true;
    return;
  }

  const recent = records.slice(0, 3);
  const archive = records.slice(3);
  recentRoot.innerHTML = recent.map((record, index) => renderHistoryCard(record, index)).join('');

  if (!archive.length) {
    archiveRoot.innerHTML = '';
    archiveSection.hidden = true;
    return;
  }

  archiveSection.hidden = false;
  archiveRoot.innerHTML = archive.map((record, index) => renderHistoryCard(record, index + 3)).join('');
}

function renderTotals(records) {
  const peopleRoot = document.getElementById('hof-people-totals-grid');
  const constructorRoot = document.getElementById('hof-constructor-totals-grid');
  const headline = document.getElementById('hof-total-seasons');
  if (!peopleRoot || !constructorRoot || !headline) return;

  headline.textContent = `${records.length} ${records.length === 1 ? 'Saison' : 'Saisons'} verewigt`;

  const personTotals = buildPersonTotals(records);
  const constructorTotals = buildConstructorTotals(records);

  peopleRoot.innerHTML = personTotals.length
    ? personTotals.map((entry, index) => `
      <article class="hof-total-card">
        <div class="hof-total-rank">#${index + 1}</div>
        <div class="hof-total-name">${escapeHtml(entry.name)}</div>
        <div class="hof-total-stats">${entry.driver}x Fahrerweltmeister · ${entry.constructor}x Konstrukteursweltmeister</div>
      </article>
    `).join('')
    : '<div class="hof-empty">Noch keine Personenstatistik vorhanden.</div>';

  constructorRoot.innerHTML = constructorTotals.length
    ? constructorTotals.map((entry, index) => `
      <article class="hof-total-card">
        <div class="hof-total-rank">#${index + 1}</div>
        <div class="hof-total-name">${escapeHtml(entry.name)}</div>
        <div class="hof-total-stats">${entry.total}x Konstrukteursweltmeister</div>
      </article>
    `).join('')
    : '<div class="hof-empty">Noch keine Konstrukteursstatistik vorhanden.</div>';
}

async function fetchFallbackHistory() {
  const response = await fetch('data/hall-of-fame-fallback.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Fallback-Historie konnte nicht geladen werden.');
  const payload = await response.json();
  return payload.history || [];
}

async function fetchSupabaseHistory() {
  const [historyResponse, seasonsResponse] = await Promise.all([
    window.supabaseClient
      .from('championship_history')
      .select('season_id, season_name, driver_champion, driver_champion_team, constructor_champion, constructor_champion_lineup, created_at')
      .order('created_at', { ascending: true }),
    window.supabaseClient
      .from('seasons')
      .select('id, name, is_active')
      .order('created_at', { ascending: true })
  ]);

  if (historyResponse.error) throw historyResponse.error;
  if (seasonsResponse.error) throw seasonsResponse.error;

  const seasonsById = new Map((seasonsResponse.data || []).map((season) => [String(season.id), season]));
  const merged = (historyResponse.data || []).map((record, index) => ({
    ...record,
    season_name: record.season_name || seasonsById.get(String(record.season_id))?.name || String(index + 1)
  }));
  return merged;
}

async function loadHallOfFamePage() {
  try {
    let records = [];
    let sourceLabel = '';

    try {
      records = await fetchSupabaseHistory();
      records = records.filter(isCompleteChampionRecord);
      if (!records.length) throw new Error('Keine DB-Einträge vorhanden');
      sourceLabel = 'Live-Datenbank';
    } catch (dbError) {
      console.warn('Hall of Fame DB-Fallback aktiv:', dbError);
      records = await fetchFallbackHistory();
      records = records.filter(isCompleteChampionRecord);
      sourceLabel = 'Archivdaten';
    }

    const sorted = [...records].sort((a, b) => getSeasonSortValue(b.season_name) - getSeasonSortValue(a.season_name));
    const current = sorted[0] || null;
    const history = current ? sorted.slice(1) : [...sorted];

    renderCurrentFeature(current, sourceLabel);
    renderHistory(history);
    renderTotals(sorted);
  } catch (error) {
    console.error(error);
    renderCurrentFeature(null);
    renderHistory([]);
    renderTotals([]);
  }
}

document.addEventListener('DOMContentLoaded', loadHallOfFamePage);
