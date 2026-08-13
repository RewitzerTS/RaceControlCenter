(() => {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabaseClient || !window.RCCData) return;

    async function getWorkflowScope() {
      const context = await window.RCCData.getLeagueContext();
      const season = await window.RCCData.fetchCurrentSeason({ forceRefresh: true, backgroundRefresh: false });
      if (!context?.leagueId || !season?.id) return { context, season, races: [], raceIds: [] };

      const { data: races, error } = await window.supabaseClient
        .from('races')
        .select('id, grand_prix_name, weather, season_id')
        .eq('season_id', season.id);
      if (error) throw error;
      const scopedRaces = races || [];
      return { context, season, races: scopedRaces, raceIds: scopedRaces.map((race) => race.id) };
    }

    window.fetchPendingImportsFromDb = async function fetchPendingImportsFromDbTenantScoped() {
      const { raceIds } = await getWorkflowScope();
      if (!raceIds.length) return [];

      const { data: imports, error } = await window.supabaseClient
        .from('race_result_imports')
        .select(`
          id,
          race_id,
          status,
          imported_at,
          published_at,
          races:race_id ( grand_prix_name, weather ),
          race_result_import_rows (
            id,
            driver_id,
            finish_position,
            grid_position,
            pit_stops,
            fastest_lap_time,
            race_time,
            awarded_points,
            participation_status
          )
        `)
        .in('race_id', raceIds)
        .in('status', ['draft', 'under_review'])
        .order('imported_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return imports || [];
    };

    window.renderPublishWorkflow = async function renderPublishWorkflowTenantScoped() {
      const list = document.getElementById('publish-workflow-list');
      if (!list) return;
      list.innerHTML = '<div class="notice">Import-Entwürfe werden geladen...</div>';

      try {
        const scope = await getWorkflowScope();
        if (!scope.season?.id || !scope.raceIds.length) {
          list.innerHTML = '<div class="notice">Keine aktive Saison bzw. keine Rennen vorhanden.</div>';
          return;
        }

        const [pending, driversResponse, penaltiesResponse] = await Promise.all([
          window.fetchPendingImportsFromDb(),
          window.supabaseClient
            .from('drivers')
            .select('id, display_name')
            .eq('league_id', scope.context.leagueId),
          window.supabaseClient
            .from('race_penalties')
            .select('race_id, driver_id, time_delta_ms')
            .in('race_id', scope.raceIds)
        ]);

        if (driversResponse.error) throw driversResponse.error;
        if (penaltiesResponse.error) throw penaltiesResponse.error;

        if (!pending.length) {
          list.innerHTML = '<div class="notice">Keine ausstehenden Ergebnisimporte für diese Liga vorhanden.</div>';
          return;
        }

        const driversById = new Map((driversResponse.data || []).map((driver) => [driver.id, driver.display_name]));
        const penaltiesByRace = (penaltiesResponse.data || []).reduce((map, penalty) => {
          if (!map.has(penalty.race_id)) map.set(penalty.race_id, []);
          map.get(penalty.race_id).push(penalty);
          return map;
        }, new Map());

        list.innerHTML = pending.map((item) => {
          const rawRows = (item.race_result_import_rows || []).map((row) => ({ ...row }));
          const adjustedRows = typeof window.applyPenaltiesToRows === 'function'
            ? window.applyPenaltiesToRows(rawRows, penaltiesByRace.get(item.race_id) || [])
            : rawRows;
          const previewRows = adjustedRows.slice(0, 8).map((row) => {
            const penaltySeconds = Number(row.penalty_ms || 0) / 1000;
            const penaltyLabel = penaltySeconds ? ` (${penaltySeconds > 0 ? '+' : ''}${penaltySeconds}s)` : '';
            return `<li>${row.finish_position ?? '—'}. ${window.escapeHtml(driversById.get(row.driver_id) || 'Unbekannt')} · ${window.escapeHtml(row.race_time || '—')}${window.escapeHtml(penaltyLabel)}</li>`;
          }).join('');
          const grandPrix = item.races?.grand_prix_name || `Rennen ${item.race_id}`;
          const weather = item.races?.weather || 'dynamisch';
          const racePenalties = penaltiesByRace.get(item.race_id) || [];
          return `
            <div class="workflow-card">
              <div class="card-title-row">
                <div>
                  <div class="card-label">${item.status === 'under_review' ? 'In Prüfung' : 'Entwurf'}</div>
                  <h4 style="margin:0;">${window.escapeHtml(grandPrix)}</h4>
                </div>
                <div class="card-actions">
                  <button type="button" class="button-primary publish-results-btn" data-import-id="${item.id}" data-race-id="${item.race_id}">Jetzt veröffentlichen</button>
                  <button type="button" class="button-secondary discard-results-btn" data-import-id="${item.id}" data-race-id="${item.race_id}">Entwurf löschen</button>
                </div>
              </div>
              <div class="workflow-grid">
                <div>
                  <strong>Importiert:</strong> ${item.imported_at ? new Date(item.imported_at).toLocaleString('de-DE') : '—'}<br>
                  <strong>Status:</strong> ${item.status === 'under_review' ? 'Steward-Prüfung läuft' : 'Wartet auf Steward-Prüfung'}<br>
                  <strong>Wetter:</strong> ${window.escapeHtml(window.formatWeatherLabel?.(weather) || weather)}<br>
                  <strong>Zeitkorrekturen:</strong> ${racePenalties.length}
                </div>
                <div>
                  <strong>Vorschau</strong>
                  <ol class="workflow-list">${previewRows || '<li>Noch keine Zeilen vorhanden.</li>'}</ol>
                </div>
              </div>
            </div>`;
        }).join('');
      } catch (error) {
        console.error(error);
        const timeout = /statement timeout|canceling statement/i.test(String(error?.message || ''));
        list.innerHTML = `<div class="notice notice-error">${timeout ? 'Der Ergebnis-Workflow hat beim Laden zu lange gebraucht. Bitte erneut laden.' : `Workflow konnte nicht geladen werden: ${window.escapeHtml(error.message || 'Unbekannter Fehler')}`}</div>`;
      }
    };
  });
})();
