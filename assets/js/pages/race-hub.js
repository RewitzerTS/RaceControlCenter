(() => {
  if (window.RCCRaceHub) return;

  const byId = (id) => document.getElementById(id);

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

  async function renderSeasonProgress() {
    const valueEl = byId('race-hub-progress-value');
    const copyEl = byId('race-hub-progress-copy');
    const barEl = byId('race-hub-progress-bar');
    const completedEl = byId('race-hub-progress-completed');
    const totalEl = byId('race-hub-progress-total');
    const statusEl = byId('race-hub-status-progress');
    const seasonNameEl = byId('race-hub-progress-season');

    if (!valueEl || !copyEl || !barEl) return;

    try {
      const resolved = await resolveSeason();
      if (!resolved.season?.id) {
        valueEl.textContent = '0%';
        copyEl.textContent = 'Noch keine Saison eingerichtet.';
        barEl.style.width = '0%';
        if (completedEl) completedEl.textContent = '0';
        if (totalEl) totalEl.textContent = '0';
        if (statusEl) statusEl.textContent = 'Noch keine Saison';
        if (seasonNameEl) seasonNameEl.textContent = '—';
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

      valueEl.textContent = `${percent}%`;
      copyEl.textContent = resolved.active
        ? `${completed} von ${total} Rennen sind abgeschlossen. ${open ? `${open} Rennen stehen noch aus.` : 'Alle Rennen sind gefahren.'}`
        : `${resolved.season.name || 'Die Saison'} ist abgeschlossen.`;
      barEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
      barEl.setAttribute('aria-valuenow', String(percent));
      if (completedEl) completedEl.textContent = String(completed);
      if (totalEl) totalEl.textContent = String(total);
      if (seasonNameEl) seasonNameEl.textContent = resolved.season.name || 'Saison';
      if (statusEl) {
        statusEl.textContent = resolved.active
          ? `${completed}/${total} Rennen · ${percent}%`
          : 'Saison abgeschlossen';
      }
    } catch (error) {
      console.error('Race Hub season progress failed:', error);
      valueEl.textContent = '—';
      copyEl.textContent = 'Saisonfortschritt konnte nicht geladen werden.';
      if (statusEl) statusEl.textContent = 'Nicht verfügbar';
    }
  }

  function refresh() {
    syncLatestRace();
    renderSeasonProgress();
  }

  window.RCCRaceHub = { refresh, syncLatestRace, renderSeasonProgress };

  document.addEventListener('dashboard:content-ready', refresh);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh, { once: true });
  } else {
    refresh();
  }
})();
