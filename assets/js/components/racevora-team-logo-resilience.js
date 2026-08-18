(() => {
  if (window.__raceVoraTeamLogoResilienceApplied) return;

  const originalCreateBadge = window.createTeamLogoBadge;
  const getMeta = window.getTeamLogoMeta;
  const escape = window.escapeHtml || ((value) => String(value ?? ''));
  const version = '2026-08-18-2';

  if (typeof originalCreateBadge !== 'function' || typeof getMeta !== 'function') return;

  const assetSlugs = new Map([
    ['McLaren', 'mclaren'],
    ['Ferrari', 'ferrari'],
    ['Red Bull Racing', 'red-bull'],
    ['Mercedes', 'mercedes'],
    ['Aston Martin', 'aston-martin'],
    ['Alpine', 'alpine'],
    ['Haas', 'haas'],
    ['Racing Bulls', 'racing-bulls'],
    ['Williams', 'williams'],
    ['Sauber', 'sauber'],
    ['Audi', 'audi'],
    ['Cadillac', 'cadillac']
  ]);

  const svgOnly = new Set(['Audi', 'Cadillac']);

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function fallbackCanonicalName(value) {
    const name = normalize(value);
    if (!name) return '';
    if (/\bmclaren\b/.test(name)) return 'McLaren';
    if (/\bferrari\b/.test(name)) return 'Ferrari';
    if (/\b(red bull|redbull)\b/.test(name)) return 'Red Bull Racing';
    if (/\bmercedes\b|\bpetronas\b/.test(name)) return 'Mercedes';
    if (/\baston martin\b/.test(name)) return 'Aston Martin';
    if (/\balpine\b|\brenault\b/.test(name)) return 'Alpine';
    if (/\bhaas\b/.test(name)) return 'Haas';
    if (/\bracing bulls\b|\bvisa cash app rb\b|\bvcarb\b|\balphatauri\b|\balpha tauri\b|\btoro rosso\b/.test(name)) return 'Racing Bulls';
    if (/\bwilliams\b/.test(name)) return 'Williams';
    if (/\baudi\b/.test(name)) return 'Audi';
    if (/\bcadillac\b/.test(name)) return 'Cadillac';
    if (/\bsauber\b|\bstake f1\b|\bkick f1\b|\balfa romeo\b/.test(name)) return 'Sauber';
    return '';
  }

  function resolveMeta(teamName) {
    const nativeMeta = getMeta(teamName);
    if (nativeMeta?.name && assetSlugs.has(nativeMeta.name)) return nativeMeta;
    const canonical = fallbackCanonicalName(teamName);
    return canonical ? { name: canonical } : nativeMeta;
  }

  function assetUrl(path) {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}v=${encodeURIComponent(version)}`;
  }

  function createResilientBadge(teamName, options = {}) {
    const safeTeamName = String(teamName || '').trim();
    const meta = resolveMeta(safeTeamName);
    const slug = meta?.name ? assetSlugs.get(meta.name) : '';

    if (!slug) return originalCreateBadge(teamName, options);

    const sizeClass = options.size === 'large' ? ' team-logo-badge--large' : '';
    const labelSource = String(options.label || meta.name || safeTeamName).trim() || 'Team';
    const label = escape(labelSource);
    const primary = assetUrl(`assets/images/team-logos/${slug}.${svgOnly.has(meta.name) ? 'svg' : 'png'}`);
    const fallback = svgOnly.has(meta.name)
      ? ''
      : assetUrl(`assets/images/team-logos/${slug}.svg`);

    return `
      <span class="team-logo-badge${sizeClass}" data-team-logo-name="${escape(meta.name)}" title="${label}" aria-label="${label}">
        <img
          src="${escape(primary)}"
          ${fallback ? `data-fallback-src="${escape(fallback)}"` : ''}
          data-fallback-used="0"
          alt="${label}"
          loading="eager"
          decoding="async"
          referrerpolicy="no-referrer"
          onerror="if (this.dataset.fallbackUsed !== '1' && this.dataset.fallbackSrc) { this.dataset.fallbackUsed = '1'; this.src = this.dataset.fallbackSrc; } else { this.parentElement.classList.add('is-fallback'); this.remove(); this.parentElement.textContent='${label}'; }"
        >
      </span>
    `;
  }

  window.createTeamLogoBadge = createResilientBadge;
  window.__raceVoraTeamLogoResilienceApplied = true;
})();