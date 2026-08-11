(() => {
  if (document.body?.dataset.page !== 'admin') return;

  let prepared = false;
  let preparing = null;

  function addLeagueId(payload, leagueId, table) {
    const enhanceRow = (row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
      const next = { ...row, league_id: leagueId };
      if (table === 'seasons' && !String(next.slug || '').trim()) {
        const base = String(next.name || 'season')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'season';
        next.slug = base;
      }
      return next;
    };

    return Array.isArray(payload) ? payload.map(enhanceRow) : enhanceRow(payload);
  }

  function installLeagueScopedSupabase(leagueId) {
    const client = window.supabaseClient;
    if (!client || client.__rccLeagueScoped === leagueId) return;

    const originalFrom = client.from.bind(client);
    const rootTables = new Set(['drivers', 'seasons', 'league_content']);

    client.from = (table) => {
      const builder = originalFrom(table);
      if (!rootTables.has(table)) return builder;

      const originalSelect = builder.select.bind(builder);
      const originalInsert = builder.insert.bind(builder);
      const originalUpsert = builder.upsert.bind(builder);
      const originalUpdate = builder.update.bind(builder);
      const originalDelete = builder.delete.bind(builder);

      builder.select = (...args) => originalSelect(...args).eq('league_id', leagueId);
      builder.insert = (payload, options) => originalInsert(addLeagueId(payload, leagueId, table), options);
      builder.upsert = (payload, options = {}) => {
        const scopedOptions = table === 'league_content'
          ? { ...options, onConflict: 'league_id,id' }
          : options;
        return originalUpsert(addLeagueId(payload, leagueId, table), scopedOptions);
      };
      builder.update = (...args) => originalUpdate(...args).eq('league_id', leagueId);
      builder.delete = (...args) => originalDelete(...args).eq('league_id', leagueId);

      return builder;
    };

    client.__rccLeagueScoped = leagueId;
  }

  function installLeagueRoleGuards() {
    window.isAdminSession = (session) => Boolean(session?.user && window.RCCLeagueContext?.isAdmin?.());

    window.requireAdminSession = async () => {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data?.session) throw new Error('Keine aktive Session. Bitte zuerst einloggen.');

      await window.RCCData.getLeagueContext({ forceRefresh: true });
      if (!window.RCCLeagueContext?.isAdmin?.()) {
        throw new Error('Du hast in dieser Liga keine Owner- oder Admin-Berechtigung.');
      }
      return data.session;
    };

    const originalRefreshSessionStatus = window.refreshSessionStatus;
    if (typeof originalRefreshSessionStatus === 'function') {
      window.refreshSessionStatus = async (...args) => {
        await window.RCCData.getLeagueContext({ forceRefresh: true }).catch(() => null);
        return originalRefreshSessionStatus(...args);
      };
    }

    const originalManualVisibility = window.updateManualResultsVisibility;
    if (typeof originalManualVisibility === 'function') {
      window.updateManualResultsVisibility = async (...args) => {
        await window.RCCData.getLeagueContext({ forceRefresh: true }).catch(() => null);
        return originalManualVisibility(...args);
      };
    }

    const originalAdminOverview = window.updateAdminOverview;
    if (typeof originalAdminOverview === 'function') {
      window.updateAdminOverview = async (...args) => {
        await window.RCCData.getLeagueContext().catch(() => null);
        return originalAdminOverview(...args);
      };
    }
  }

  function installStewardCaseScope() {
    if (typeof window.loadStewardCasesForAdmin !== 'function') return;

    window.loadStewardCasesForAdmin = async () => {
      const list = document.getElementById('admin-incident-list');
      if (!list) return;
      list.innerHTML = '<div class="notice">Steward-Fälle werden geladen...</div>';

      try {
        const currentSeason = await window.RCCData.fetchCurrentSeason();
        const races = currentSeason?.id ? await window.RCCData.fetchRaces({ seasonId: currentSeason.id }) : [];
        const raceIds = races.map((race) => race.id).filter(Boolean);

        if (!raceIds.length) {
          stewardCaseCache = [];
          list.innerHTML = '<div class="notice">Noch kein Steward-Fall vorhanden.</div>';
          return;
        }

        const { data, error } = await window.supabaseClient
          .from('steward_cases')
          .select(`
            id,
            race_id,
            title,
            description,
            decision_text,
            consequence,
            driver_1_id,
            driver_2_id,
            created_at,
            races:race_id ( grand_prix_name ),
            driver1:driver_1_id ( display_name ),
            driver2:driver_2_id ( display_name )
          `)
          .in('race_id', raceIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        stewardCaseCache = data || [];
        renderStewardCaseAdminList();
      } catch (error) {
        console.error(error);
        list.innerHTML = '<div class="notice">Fehler beim Laden der Steward-Fälle.</div>';
      }
    };
  }

  function installSeasonStartScope() {
    if (typeof window.startNewSeason !== 'function') return;

    window.startNewSeason = async () => {
      if (state.isStartingSeason) return;
      state.isStartingSeason = true;
      clearFeedback('season-feedback');

      try {
        await requireAdminSession();
        const currentSeason = await getCurrentSeasonSafe();
        if (currentSeason) throw new Error('Es gibt bereits eine aktive Saison. Bitte diese zuerst abschließen.');

        const nextSeasonGameKey = getSelectedSeasonGameKey();
        const nextSeasonGameLabel = resolveSeasonGameLabel(nextSeasonGameKey);
        const seasons = await window.RCCData.fetchSeasons({ forceRefresh: true, backgroundRefresh: false });
        const maxSeasonNumber = (seasons || []).reduce((maxValue, season) => {
          const number = Number(String(season?.name || '').match(/(\d+)/)?.[1] || 0);
          return Math.max(maxValue, Number.isFinite(number) ? number : 0);
        }, 0);
        const nextSeasonNumber = maxSeasonNumber + 1;

        const confirmed = window.confirm(`Neue Saison ${nextSeasonNumber} für ${nextSeasonGameLabel} starten?`);
        if (!confirmed) return;

        const createResponse = await window.supabaseClient
          .from('seasons')
          .insert([{
            name: `Saison ${nextSeasonNumber}`,
            slug: `saison-${nextSeasonNumber}`,
            is_active: true,
            game_key: nextSeasonGameKey,
            game_label: nextSeasonGameLabel
          }])
          .select()
          .single();

        if (createResponse.error) throw createResponse.error;

        showFeedback('season-feedback', `Erfolg: Saison ${nextSeasonNumber} wurde für ${nextSeasonGameLabel} gestartet.`);
        await Promise.all([
          loadSeasonSummary(),
          loadRaceOptions(),
          populateManualRaceSelect(),
          renderPublishWorkflow()
        ]);
      } catch (error) {
        console.error(error);
        showFeedback('season-feedback', error.message || 'Neue Saison konnte nicht gestartet werden.', true);
      } finally {
        state.isStartingSeason = false;
      }
    };
  }

  async function prepare() {
    if (prepared) return;
    if (preparing) return preparing;

    preparing = (async () => {
      const context = await window.RCCData.getLeagueContext({ forceRefresh: true });
      if (!context?.leagueId) throw new Error('Keine aktive Liga für das Admin Center gefunden.');

      installLeagueScopedSupabase(context.leagueId);
      installLeagueRoleGuards();
      installStewardCaseScope();
      installSeasonStartScope();
      prepared = true;
    })().finally(() => {
      preparing = null;
    });

    return preparing;
  }

  window.RCCAdminTenant = { prepare };

  document.addEventListener('DOMContentLoaded', async (event) => {
    event.stopImmediatePropagation();
    try {
      await prepare();
      if (typeof window.initAdminPage === 'function') {
        await window.initAdminPage();
      }
    } catch (error) {
      console.error('RCC Admin tenant bootstrap failed.', error);
      const status = document.getElementById('admin-session-status');
      if (status) status.textContent = `Admin Center konnte nicht initialisiert werden: ${error.message}`;
    }
  });
})();
