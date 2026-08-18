(() => {
  if (window.RCCRaceHub) return;

  const byId = (id) => document.getElementById(id);

  function ensureInsightsSection() {
    if (byId('racing-insights-section')) return byId('racing-insights-section');
    const podium = document.querySelector('.podium-grid');
    if (!podium) return null;
    const section = document.createElement('section');
    section.id = 'racing-insights-section';
    section.className = 'racing-insights-section';
    section.hidden = true;
    section.innerHTML = `
      <div class="racing-insights-header">
        <div>
          <div class="card-label">Automatisch aus Renndaten</div>
          <h2>Racing Insights</h2>
        </div>
        <p>Form, Aufholjagden, Titelkampf und Serien – automatisch aus den veröffentlichten Ergebnissen dieser Saison.</p>
      </div>
      <div id="racing-insights-grid" class="racing-insights-grid" aria-live="polite"></div>
    `;
    podium.after(section);
    return section;
  }

  function ensureInsightsAssets() {
    const section = ensureInsightsSection();
    if (!section) return;

    if (!document.querySelector('link[data-rcc-racing-insights="true"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'assets/css/pages/racing-insights.css';
      link.dataset.rccRacingInsights = 'true';
      document.head.appendChild(link);
    }

    if (window.RCCRacingInsights) {
      window.RCCRacingInsights.restoreCache?.();
      window.RCCRacingInsights.render?.();
      return;
    }
    if (document.querySelector('script[data-rcc-racing-insights="true"]')) return;

    const script = document.createElement('script');
    script.src = 'assets/js/pages/racing-insights.js';
    script.async = true;
    script.dataset.rccRacingInsights = 'true';
    script.onload = () => {
      window.RCCRacingInsights?.restoreCache?.();
      window.RCCRacingInsights?.render?.();
    };
    script.onerror = () => console.warn('Racing Insights konnten nicht geladen werden.');
    document.body.appendChild(script);
  }

  function ensureCommunitySection() {
    if (byId('race-hub-community')) return byId('race-hub-community');
    const insights = ensureInsightsSection();
    const podium = document.querySelector('.podium-grid');
    const anchor = insights || podium;
    if (!anchor) return null;
    const section = document.createElement('section');
    section.id = 'race-hub-community';
    section.className = 'race-hub-community';
    section.hidden = true;
    section.innerHTML = `
      <article class="race-hub-community-card">
        <div class="race-hub-community-head">
          <div><div class="card-label">Formbarometer</div><h2>Aktuelle Formfahrer</h2></div>
          <p>Performance Index aus den letzten veröffentlichten Starts. Zeitraum: <strong id="race-hub-community-season">aktuelle Saison</strong>.</p>
        </div>
        <div id="race-hub-form-drivers" class="race-hub-form-list"><div class="race-hub-community-empty">Formranking wird berechnet…</div></div>
      </article>
      <article class="race-hub-community-card">
        <div class="race-hub-community-head">
          <div><div class="card-label">Liga-Highlights</div><h2>Rekorde im Fokus</h2></div>
          <a class="btn-secondary-ghost" href="rekorde.html">Alle Rekorde</a>
        </div>
        <div id="race-hub-record-highlights" class="race-hub-highlight-grid"><div class="race-hub-community-empty">Highlights werden berechnet…</div></div>
      </article>
      <article class="race-hub-explore">
        <div class="race-hub-community-head">
          <div><div class="card-label">RaceVora Driver Hub</div><h2>Liga entdecken</h2></div>
          <p>Direkt zu Profilen, Teams, Strecken, Vergleichen und Rekorden.</p>
        </div>
        <div id="race-hub-explore-grid" class="race-hub-explore-grid"></div>
      </article>
    `;
    anchor.after(section);
    return section;
  }

  function loadCommunityScript(src, marker, ready) {
    if (ready?.()) return Promise.resolve();
    const existing = document.querySelector(`script[data-rcc-community-module="${marker}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (ready?.()) return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.rccCommunityModule = marker;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  async function ensureCommunityAssets() {
    const section = ensureCommunitySection();
    if (!section) return;
    if (!document.querySelector('link[data-rcc-community-style="true"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'assets/css/pages/race-hub-community.css';
      link.dataset.rccCommunityStyle = 'true';
      document.head.appendChild(link);
    }
    try {
      await loadCommunityScript('assets/js/services/rcc-driver-stats.js', 'driver-stats', () => Boolean(window.RCCDriverStats));
      await loadCommunityScript('assets/js/services/rcc-team-stats.js', 'team-stats', () => Boolean(window.RCCTeamStats));
      await loadCommunityScript('assets/js/services/rcc-driver-performance.js', 'driver-performance', () => Boolean(window.RCCDriverPerformance));
      await loadCommunityScript('assets/js/services/rcc-records.js', 'records', () => Boolean(window.RCCRecords));
      await loadCommunityScript('assets/js/pages/race-hub-community.js', 'community-page', () => Boolean(window.RCCRaceHubCommunity));
      window.RCCRaceHubCommunity?.render?.();
    } catch (error) {
      console.warn('Race Hub Community konnte nicht geladen werden:', error);
      section.hidden = false;
    }
  }

  function copyText(sourceId, targetId, fallback = '—') {
    const source = byId(sourceId);
    const target = byId(targetId);
    if (!target) return '';
    const value = String(source?.textContent || '').trim();
    target.textContent = value || fallback;
    return value;
  }

  function copyHtml(sourceId, targetId, fallback = '') {
    const source = byId(sourceId);
    const target = byId(targetId);
    if (!target) return '';
    const value = String(source?.innerHTML || '').trim();
    target.innerHTML = value || fallback;
    return value;
  }

  function syncLatestRace() {
    const title = copyText('latest-race-title', 'race-hub-latest-title', 'Noch kein gewertetes Rennen');
    const summary = copyHtml(
      'latest-race-summary',
      'race-hub-latest-summary',
      '<span class="muted">Sobald das erste Rennen veröffentlicht wurde, erscheinen hier Sieger, Podium und schnellste Runde.</span>'
    );

    copyHtml(
      'latest-race-podium',
      'race-hub-latest-podium',
      '<div class="race-hub-empty">Noch kein Podium vorhanden.</div>'
    );
    copyHtml(
      'latest-race-facts',
      'race-hub-latest-facts',
      '<div class="fact-card"><span>Sieger</span><strong>—</strong></div><div class="fact-card"><span>FL</span><strong>—</strong></div>'
    );

    const sourceLink = byId('latest-race-link');
    const targetLink = byId('race-hub-latest-link');
    if (targetLink) {
      const href = String(sourceLink?.getAttribute('href') || '').trim();
      targetLink.hidden = !href || !title || !summary;
      if (href) targetLink.setAttribute('href', href);
    }

    const winner = String(byId('latest-race-winner')?.textContent || '').trim();
    const statusWinner = byId('race-hub-status-winner');
    if (statusWinner) statusWinner.textContent = winner || 'Noch kein Sieger';
  }

  async function resolveSeason() {
    const active = await window.RCCData?.fetchCurrentSeason?.().catch(() => null);
    if (active?.id) return { season: active, active: true };
    const seasons = await window.RCCData?.fetchSeasons?.().catch(() => []);
    return { season: seasons?.[0] || null, active: false };
  }

  async function renderLatestPole() {
    const facts = byId('race-hub-latest-facts');
    if (!facts) return;
    try {
      const resolved = await resolveSeason();
      if (!resolved.season?.id) return;
      const races = await window.RCCData.fetchRaces({ seasonId: resolved.season.id });
      const completed = (races || [])
        .map((race) => ({
          ...race,
          lifecycleStatus: window.getRaceLifecycleStatus ? window.getRaceLifecycleStatus(race) : race.status
        }))
        .filter((race) => race.lifecycleStatus === 'completed')
        .sort((a, b) => Number(b.round_number || 0) - Number(a.round_number || 0));
      const latest = completed[0];
      if (!latest?.id) return;

      const [rows, drivers] = await Promise.all([
        window.RCCData.fetchRaceResults({ raceId: latest.id }),
        window.RCCData.fetchDrivers()
      ]);
      const poleRow = (rows || []).find((row) => Number(row.grid_position) === 1);
      if (!poleRow?.driver_id) return;
      const poleDriver = (drivers || []).find((driver) => String(driver.id) === String(poleRow.driver_id));
      const poleName = poleDriver?.display_name || '—';
      const cards = [...facts.querySelectorAll('.fact-card')];
      const poleCard = cards.find((card) => /pole/i.test(String(card.querySelector('span')?.textContent || '')));
      const value = poleCard?.querySelector('strong');
      if (value) value.textContent = poleName;
    } catch (error) {
      console.warn('Race Hub pole fact could not be resolved:', error);
    }
  }

  async function renderSeasonProgress() {
    const valueEl = byId('race-hub-progress-value');
    const copyEl = byId('race-hub-progress-copy');
    const barEl = byId('race-hub-progress-bar');
    const trackEl = barEl?.parentElement || null;
    const completedEl = byId('race-hub-progress-completed');
    const totalEl = byId('race-hub-progress-total');
    const statusEl = byId('race-hub-status-progress');
    const seasonNameEl = byId('race-hub-progress-season');
    const progressStateEl = byId('race-hub-progress-state');
    const seasonStatusEl = byId('status-season');

    if (!valueEl || !copyEl || !barEl) return;

    try {
      const resolved = await resolveSeason();
      if (!resolved.season?.id) {
        valueEl.textContent = '0%';
        copyEl.textContent = 'Noch keine Saison eingerichtet.';
        barEl.style.width = '0%';
        trackEl?.setAttribute('aria-valuenow', '0');
        if (completedEl) completedEl.textContent = '0';
        if (totalEl) totalEl.textContent = '0';
        if (statusEl) statusEl.textContent = 'Noch keine Saison';
        if (seasonNameEl) seasonNameEl.textContent = '—';
        if (progressStateEl) progressStateEl.textContent = 'Nicht gestartet';
        if (seasonStatusEl) seasonStatusEl.textContent = 'Keine Saison';
        return;
      }

      const races = await window.RCCData.fetchRaces({ seasonId: resolved.season.id });
      const lifecycle = (races || []).map((race) => ({
        ...race,
        lifecycleStatus: window.getRaceLifecycleStatus ? window.getRaceLifecycleStatus(race) : race.status
      }));
      const total = lifecycle.length;
      const completed = lifecycle.filter((race) => race.lifecycleStatus === 'completed').length;
      const percent = total ? Math.round((completed / total) * 100) : 0;
      const open = Math.max(total - completed, 0);
      const seasonLabel = resolved.season.name || 'Saison';

      valueEl.textContent = `${percent}%`;
      copyEl.textContent = resolved.active
        ? `${completed} von ${total} Rennen sind abgeschlossen. ${open ? `${open} Rennen stehen noch aus.` : 'Alle Rennen sind gefahren.'}`
        : `${seasonLabel} ist abgeschlossen.`;
      barEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
      trackEl?.setAttribute('aria-valuenow', String(percent));
      if (completedEl) completedEl.textContent = String(completed);
      if (totalEl) totalEl.textContent = String(total);
      if (seasonNameEl) seasonNameEl.textContent = seasonLabel;
      if (progressStateEl) progressStateEl.textContent = resolved.active ? 'Aktiv' : 'Abgeschlossen';
      if (seasonStatusEl) seasonStatusEl.textContent = resolved.active ? `${seasonLabel} aktiv` : `${seasonLabel} abgeschlossen`;
      if (statusEl) statusEl.textContent = resolved.active
        ? `${completed}/${total} Rennen · ${percent}%`
        : 'Saison abgeschlossen';
    } catch (error) {
      console.error('Race Hub season progress failed:', error);
      valueEl.textContent = '—';
      copyEl.textContent = 'Saisonfortschritt konnte nicht geladen werden.';
      if (statusEl) statusEl.textContent = 'Nicht verfügbar';
      if (progressStateEl) progressStateEl.textContent = 'Unbekannt';
    }
  }

  function refresh() {
    syncLatestRace();
    renderSeasonProgress();
    renderLatestPole();
    ensureInsightsAssets();
    ensureCommunityAssets();
  }

  window.RCCRaceHub = {
    refresh,
    syncLatestRace,
    renderSeasonProgress,
    renderLatestPole,
    ensureInsightsAssets,
    ensureCommunityAssets
  };

  document.addEventListener('dashboard:content-ready', refresh);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh, { once: true });
  } else {
    refresh();
  }
})();