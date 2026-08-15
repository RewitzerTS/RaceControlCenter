(() => {
  const uxStyle = document.createElement('style');
  uxStyle.id = 'rcc-admin-ux-pass1';
  uxStyle.textContent = `
    @media (min-width: 861px) {
      html { scrollbar-width: none; }
      html::-webkit-scrollbar { display: none; width: 0; height: 0; }
      body { overflow-x: clip; }
      .main-nav, .admin-mobile-tabs, .table-wrap { scrollbar-width: none; }
      .main-nav::-webkit-scrollbar, .admin-mobile-tabs::-webkit-scrollbar, .table-wrap::-webkit-scrollbar { display: none; width: 0; height: 0; }
    }
    body[data-page="admin"] .admin-layout { display: block; }
    body[data-page="admin"] .admin-layout > details.panel { width: 100%; margin: 0; }
    body[data-page="admin"] .admin-layout > details.panel > summary { display: none; }
    body[data-page="admin"] .admin-mobile-tabs {
      position: sticky;
      top: calc(var(--site-header-offset, 0px) + 10px);
      z-index: 80;
      display: flex;
      gap: 8px;
      padding: 9px;
      margin-bottom: 18px;
      overflow-x: auto;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(2, 27, 52, 0.94);
      backdrop-filter: blur(16px);
      box-shadow: 0 12px 30px rgba(0,0,0,.18);
      scrollbar-width: none;
    }
    body[data-page="admin"] .admin-mobile-tabs::-webkit-scrollbar { display:none; }
    body[data-page="admin"] .admin-mobile-tab {
      flex: 1 0 auto;
      min-width: 130px;
      min-height: 44px;
      border-radius: 12px;
      white-space: nowrap;
    }
    body[data-page="admin"] .admin-mobile-tab.is-active {
      box-shadow: inset 0 0 0 1px rgba(44,143,166,.22), 0 8px 20px rgba(0,0,0,.14);
    }
    body[data-page="admin"] .admin-layout > details.panel[open] { padding: 0; border: 0; background: transparent; box-shadow: none; }
    body[data-page="admin"] .admin-layout > details.panel[open]:hover { transform: none; }
    body[data-page="admin"] .admin-layout > details.panel > section,
    body[data-page="admin"] .admin-layout > details.panel > details { margin-left: 0; margin-right: 0; }
    @media (max-width: 860px) {
      body[data-page="admin"] .admin-mobile-tabs { top: calc(76px + env(safe-area-inset-top) + 8px); }
      body[data-page="admin"] .admin-mobile-tab { min-width: 118px; }
    }
  `;
  document.head.appendChild(uxStyle);

  const compatScript = document.createElement('script');
  compatScript.src = 'assets/js/pages/admin-race-results-insert-compat.js';
  compatScript.defer = true;
  document.head.appendChild(compatScript);

  const aiImportScript = document.createElement('script');
  aiImportScript.src = 'assets/js/pages/admin-ai-result-import.js';
  aiImportScript.defer = true;
  document.head.appendChild(aiImportScript);

  const resultPreviewScript = document.createElement('script');
  resultPreviewScript.src = 'assets/js/pages/admin-result-preview-ui.js';
  resultPreviewScript.defer = true;
  document.head.appendChild(resultPreviewScript);

  document.addEventListener('DOMContentLoaded', () => {
    const tabLabels = {
      'admin-section-results': 'Ergebnisse',
      'admin-section-stewarding': 'Stewards',
      'admin-section-drivers': 'Fahrer & Teams',
      'admin-section-calendar': 'Rennen & Saison',
      'admin-section-rules': 'Regeln & Inhalte'
    };
    document.querySelectorAll('#admin-mobile-tabs [data-admin-tab-target]').forEach((button) => {
      const label = tabLabels[button.dataset.adminTabTarget];
      if (label) button.textContent = label;
    });

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
          window.supabaseClient.from('drivers').select('id, display_name').eq('league_id', scope.context.leagueId),
          window.supabaseClient.from('race_penalties').select('race_id, driver_id, time_delta_ms').in('race_id', scope.raceIds)
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