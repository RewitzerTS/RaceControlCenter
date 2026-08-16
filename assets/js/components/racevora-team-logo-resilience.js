(() => {
  if (window.__raceVoraTeamLogoResilienceApplied) return;

  const originalCreateBadge = window.createTeamLogoBadge;
  const getMeta = window.getTeamLogoMeta;
  const escape = window.escapeHtml || ((value) => String(value ?? ''));
  const version = '2026-08-16-1';

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

  function assetUrl(path) {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}v=${encodeURIComponent(version)}`;
  }

  function createResilientBadge(teamName, options = {}) {
    const safeTeamName = String(teamName || '').trim();
    const meta = getMeta(safeTeamName);
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
