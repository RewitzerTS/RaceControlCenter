(() => {
  let initialized = false;
  const GAME_LABELS = { f1_25: 'F1 25', f1_26: 'F1 26' };

  function feedback(message, error = false) {
    const el = document.getElementById('season-feedback');
    if (!el) return;
    el.hidden = false;
    el.style.display = 'block';
    el.textContent = message;
    el.classList.toggle('notice-error', error);
  }

  async function createNextSeason(event) {
    const button = event.target?.closest?.('#start-new-season-btn');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    button.disabled = true;
    try {
      const context = await window.RCCData.getLeagueContext({ forceRefresh: true });
      if (!context?.leagueId || !['owner','admin'].includes(context.role)) throw new Error('Owner- oder Admin-Rechte erforderlich.');
      const current = await window.RCCData.fetchCurrentSeason({ forceRefresh: true, backgroundRefresh: false });
      if (current?.id) throw new Error('Es gibt bereits eine aktive Saison. Bitte diese zuerst abschließen.');
      const gameKey = String(document.getElementById('season-game-select-new')?.value || 'f1_25').trim() || 'f1_25';
      const gameLabel = GAME_LABELS[gameKey] || gameKey;
      if (!window.confirm(`Neue Saison für ${gameLabel} in ${context.name || 'dieser Liga'} starten?`)) return;
      const { data, error } = await window.supabaseClient.rpc('create_next_league_season', {
        p_league_id: context.leagueId,
        p_game_key: gameKey,
        p_game_label: gameLabel
      });
      if (error) throw error;
      if (!data?.ok) throw new Error('Neue Saison konnte nicht angelegt werden.');
      feedback(`${data.name} wurde für ${gameLabel} gestartet. Die Saison gehört ausschließlich zu ${context.name || 'dieser Liga'}.`);
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error(error);
      feedback(error.message || 'Neue Saison konnte nicht gestartet werden.', true);
    } finally {
      button.disabled = false;
    }
  }

  function init() {
    if (initialized) return;
    document.addEventListener('click', createNextSeason, true);
    initialized = true;
  }

  window.RCCNextSeason = { init };
})();
