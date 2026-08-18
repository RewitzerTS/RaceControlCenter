(() => {
  function scopedHref(file, params = {}) {
    const base = window.withLeagueContextHref?.(file) || file;
    const url = new URL(base, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    });
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  function apply() {
    const actions = document.querySelector('.race-detail-header-actions');
    const title = document.getElementById('race-title');
    if (!actions || !title || !title.textContent || /wird geladen|nicht gefunden|kein rennen/i.test(title.textContent)) return;
    const meta = window.getRaceTrackMeta?.({ grand_prix_name: title.textContent }) || {};
    const track = meta.track;
    if (!track?.key) return;
    let link = document.getElementById('race-track-profile-link');
    if (!link) {
      link = document.createElement('a');
      link.id = 'race-track-profile-link';
      link.className = 'btn';
      link.textContent = 'Streckenprofil';
      const back = actions.querySelector('.race-detail-back-btn');
      actions.insertBefore(link, back || null);
    }
    link.href = scopedHref('strecken-profil.html', { track: track.key });
  }

  document.addEventListener('DOMContentLoaded', () => {
    apply();
    const title = document.getElementById('race-title');
    if (title) new MutationObserver(apply).observe(title, { childList: true, subtree: true, characterData: true });
  });
})();
