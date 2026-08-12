(() => {
  let initialized = false;
  let currentSeason = null;
  let races = [];
  let primaries = [];
  let reserves = [];
  let substitutions = [];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function feedback(message, isError = false) {
    const el = document.getElementById('race-substitution-feedback');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
    el.classList.toggle('notice-error', Boolean(isError));
  }

  function option(value, label) {
    return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
  }

  async function loadSeasonRoster() {
    currentSeason = await window.RCCData.fetchCurrentSeason({ forceRefresh: true, backgroundRefresh: false });
    if (!currentSeason?.id) {
      races = [];
      primaries = [];
      reserves = [];
      return;
    }

    races = await window.RCCData.fetchRaces({ seasonId: currentSeason.id, forceRefresh: true, backgroundRefresh: false });

    const { data, error } = await window.supabaseClient
      .from('driver_season_assignments')
      .select('driver_id, team_id, league_team, is_primary, drivers:driver_id(id, display_name), teams:team_id(id, display_name)')
      .eq('season_id', currentSeason.id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    primaries = (data || []).filter((row) => row.is_primary === true && row.drivers?.id);
    reserves = (data || []).filter((row) => row.is_primary === false && row.drivers?.id);
  }

  async function loadSubstitutions() {
    if (!races.length) {
      substitutions = [];
      return;
    }
    const raceIds = races.map((race) => race.id);
    const { data, error } = await window.supabaseClient
      .from('race_substitutions')
      .select(`
        id, race_id, primary_driver_id, substitute_driver_id, points_owner_driver_id,
        points_team_name, created_at,
        race:race_id(grand_prix_name, round_number),
        primary:primary_driver_id(display_name),
        substitute:substitute_driver_id(display_name),
        points_owner:points_owner_driver_id(display_name)
      `)
      .in('race_id', raceIds)
      .order('created_at', { ascending: false });
    if (error) throw error;
    substitutions = data || [];
  }

  function renderFormOptions() {
    const raceSelect = document.getElementById('race-substitution-race');
    const primarySelect = document.getElementById('race-substitution-primary');
    const reserveSelect = document.getElementById('race-substitution-reserve');
    if (raceSelect) {
      raceSelect.innerHTML = '<option value="">Rennen auswählen</option>' + races
        .slice()
        .sort((a, b) => Number(a.round_number || 0) - Number(b.round_number || 0))
        .map((race) => option(race.id, `R${race.round_number || '?'} · ${race.grand_prix_name || 'Rennen'}`))
        .join('');
    }
    if (primarySelect) {
      primarySelect.innerHTML = '<option value="">Stammfahrer auswählen</option>' + primaries
        .map((row) => option(row.drivers.id, `${row.drivers.display_name}${row.league_team ? ` · ${row.league_team}` : ''}`))
        .join('');
    }
    if (reserveSelect) {
      reserveSelect.innerHTML = '<option value="">Ersatzfahrer auswählen</option>' + reserves
        .map((row) => option(row.drivers.id, `${row.drivers.display_name}${row.league_team ? ` · ${row.league_team}` : ''}`))
        .join('');
    }
  }

  function renderList() {
    const list = document.getElementById('race-substitution-list');
    if (!list) return;
    if (!substitutions.length) {
      list.innerHTML = '<div class="notice">Für die aktuelle Saison sind noch keine Ersatzfahrer-Einsätze hinterlegt.</div>';
      return;
    }
    list.innerHTML = substitutions.map((entry) => `
      <article class="panel section-spacer-top">
        <strong>R${escapeHtml(entry.race?.round_number || '?')} · ${escapeHtml(entry.race?.grand_prix_name || 'Rennen')}</strong>
        <div class="muted">${escapeHtml(entry.substitute?.display_name || 'Ersatzfahrer')} fährt für ${escapeHtml(entry.primary?.display_name || 'Stammfahrer')}</div>
        <div class="muted">Fahrerpunkte: ${escapeHtml(entry.points_owner?.display_name || '—')} · Teampunkte: ${escapeHtml(entry.points_team_name || '—')}</div>
        <div class="card-actions">
          <button type="button" class="button-secondary button-danger" data-remove-substitution="${escapeHtml(entry.id)}">Einsatz entfernen</button>
        </div>
      </article>`).join('');

    list.querySelectorAll('[data-remove-substitution]').forEach((button) => {
      button.addEventListener('click', () => removeSubstitution(button.dataset.removeSubstitution));
    });
  }

  async function refresh() {
    feedback('');
    try {
      await loadSeasonRoster();
      await loadSubstitutions();
      renderFormOptions();
      renderList();
      const emptyNotice = document.getElementById('race-substitution-empty');
      if (emptyNotice) {
        emptyNotice.hidden = Boolean(currentSeason?.id && races.length && primaries.length && reserves.length);
        if (!currentSeason?.id) emptyNotice.textContent = 'Es gibt noch keine aktive Saison.';
        else if (!races.length) emptyNotice.textContent = 'Für die aktive Saison gibt es noch keine Rennen.';
        else if (!primaries.length) emptyNotice.textContent = 'Für diese Saison sind noch keine Stammfahrer-Slots vorhanden.';
        else if (!reserves.length) emptyNotice.textContent = 'Für diese Saison ist noch kein Ersatzfahrer hinterlegt.';
      }
      const form = document.getElementById('race-substitution-form');
      if (form) form.hidden = !(currentSeason?.id && races.length && primaries.length && reserves.length);
    } catch (error) {
      console.error(error);
      feedback(`Ersatzfahrer-Daten konnten nicht geladen werden: ${error.message || 'Unbekannter Fehler'}`, true);
    }
  }

  async function saveSubstitution() {
    const raceId = String(document.getElementById('race-substitution-race')?.value || '').trim();
    const primaryId = String(document.getElementById('race-substitution-primary')?.value || '').trim();
    const reserveId = String(document.getElementById('race-substitution-reserve')?.value || '').trim();
    const pointsMode = String(document.getElementById('race-substitution-points-owner')?.value || 'primary').trim();
    const button = document.getElementById('race-substitution-save');

    if (!raceId || !primaryId || !reserveId) {
      feedback('Bitte Rennen, Stammfahrer und Ersatzfahrer auswählen.', true);
      return;
    }
    if (primaryId === reserveId) {
      feedback('Stamm- und Ersatzfahrer müssen unterschiedlich sein.', true);
      return;
    }

    if (button) button.disabled = true;
    feedback('Ersatzfahrer-Einsatz wird gespeichert...');
    try {
      const { data, error } = await window.supabaseClient.rpc('set_race_substitution', {
        p_race_id: raceId,
        p_primary_driver_id: primaryId,
        p_substitute_driver_id: reserveId,
        p_points_owner_mode: pointsMode
      });
      if (error) throw error;
      if (!data?.ok) throw new Error('Der Einsatz konnte nicht gespeichert werden.');
      feedback('Ersatzfahrer-Einsatz gespeichert. Die Punktezuordnung wird beim Rennergebnis automatisch angewendet.');
      await refresh();
    } catch (error) {
      console.error(error);
      feedback(`Speichern fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function removeSubstitution(id) {
    if (!id) return;
    const confirmed = window.confirm('Diesen Ersatzfahrer-Einsatz wirklich entfernen?');
    if (!confirmed) return;
    feedback('Einsatz wird entfernt...');
    try {
      const { data, error } = await window.supabaseClient.rpc('remove_race_substitution', {
        p_substitution_id: id
      });
      if (error) throw error;
      if (data !== true) throw new Error('Einsatz wurde nicht gefunden.');
      feedback('Ersatzfahrer-Einsatz entfernt.');
      await refresh();
    } catch (error) {
      console.error(error);
      feedback(`Entfernen fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`, true);
    }
  }

  function buildPanel() {
    if (document.getElementById('admin-section-race-substitutions')) return;
    const layout = document.querySelector('.admin-layout');
    if (!layout) return;

    const panel = document.createElement('details');
    panel.className = 'panel admin-panel-wide';
    panel.id = 'admin-section-race-substitutions';
    panel.innerHTML = `
      <summary><strong>🔄 Ersatzfahrer-Einsätze</strong></summary>
      <section class="panel admin-panel-wide admin-panel-accent">
        <h3>Ersatzfahrer für ein Rennen einsetzen</h3>
        <div class="notice">Der Einsatz gilt nur für das ausgewählte Rennen. Die Teamwertung bleibt beim Cockpit-Team. Du entscheidest, ob die Fahrerpunkte dem Stammfahrer oder dem Ersatzfahrer gutgeschrieben werden.</div>
        <div id="race-substitution-empty" class="notice section-spacer-top" hidden></div>
        <div id="race-substitution-form" class="section-spacer-top" hidden>
          <div class="form-grid">
            <div class="field"><label for="race-substitution-race">Rennen</label><select id="race-substitution-race"></select></div>
            <div class="field"><label for="race-substitution-primary">Stammfahrer fällt aus</label><select id="race-substitution-primary"></select></div>
            <div class="field"><label for="race-substitution-reserve">Ersatzfahrer fährt</label><select id="race-substitution-reserve"></select></div>
            <div class="field"><label for="race-substitution-points-owner">Fahrerpunkte gehen an</label><select id="race-substitution-points-owner">
              <option value="primary">Stammfahrer</option>
              <option value="substitute">Ersatzfahrer</option>
            </select></div>
          </div>
          <div class="card-actions"><button type="button" class="button-primary" id="race-substitution-save">Einsatz speichern</button></div>
        </div>
        <div id="race-substitution-feedback" class="notice section-spacer-top" hidden></div>
        <div id="race-substitution-list" class="section-spacer-top"></div>
      </section>`;
    layout.appendChild(panel);
    panel.querySelector('#race-substitution-save')?.addEventListener('click', saveSubstitution);
    panel.addEventListener('toggle', () => {
      if (panel.open) refresh();
    });
  }

  async function init() {
    if (initialized) return;
    const context = await window.RCCData?.getLeagueContext?.({ forceRefresh: true }).catch(() => null);
    if (!context?.leagueId || !['owner', 'admin'].includes(context.role)) return;
    buildPanel();
    initialized = true;
  }

  window.RCCRaceSubstitutions = { init, refresh };
})();
