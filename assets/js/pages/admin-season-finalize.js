(() => {
  let initialized = false;

  async function buildPreview() {
    const season = await window.RCCData.fetchCurrentSeason({ forceRefresh: true, backgroundRefresh: false });
    if (!season?.id) throw new Error('Keine aktive Saison gefunden.');
    const [drivers, races, raceResults] = await Promise.all([
      window.RCCData.fetchDrivers({ forceRefresh: true, backgroundRefresh: false }),
      window.RCCData.fetchRaces({ seasonId: season.id, forceRefresh: true, backgroundRefresh: false }),
      window.RCCData.fetchRaceResults({ seasonId: season.id, forceRefresh: true, backgroundRefresh: false })
    ]);
    const { driverStandings, teamStandings } = window.RCCData.buildStandings({ drivers, races, raceResults });
    return { season, races, driverStandings, teamStandings, driverChampion: driverStandings[0] || null, constructorChampion: teamStandings[0] || null };
  }

  async function finalize(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    const button = document.getElementById('finalize-season-btn');
    if (button) button.disabled = true;
    try {
      const preview = await buildPreview();
      const openRaces = preview.races.filter((race) => !['completed','official'].includes(String(race.status || '').toLowerCase()));
      if (openRaces.length) {
        throw new Error(`${openRaces.length} Rennen sind noch nicht abgeschlossen oder offiziell.`);
      }
      const driverChampion = preview.driverChampion?.driverName || null;
      const constructorChampion = preview.constructorChampion?.teamName || null;
      const confirmed = window.confirm(`Saison ${preview.season.name} final abschließen?\n\nFahrer-Weltmeister: ${driverChampion || '—'}\nKonstrukteurs-Weltmeister: ${constructorChampion || '—'}\n\nDie Saison wird archiviert und kann danach nicht mehr als aktive Saison bearbeitet werden.`);
      if (!confirmed) return;
      const typed = window.prompt('Zur Bestätigung bitte SAISON eingeben:', '');
      if (String(typed || '').trim().toUpperCase() !== 'SAISON') return;

      const snapshot = {
        version: 1,
        finalized_at: new Date().toISOString(),
        races: preview.races.map((race) => ({ id: race.id, round_number: race.round_number, grand_prix_name: race.grand_prix_name, status: race.status })),
        driver_standings: preview.driverStandings,
        team_standings: preview.teamStandings
      };
      const { data, error } = await window.supabaseClient.rpc('finalize_league_season', {
        p_season_id: preview.season.id,
        p_driver_champion: driverChampion,
        p_constructor_champion: constructorChampion,
        p_snapshot: snapshot
      });
      if (error) throw error;
      if (!data?.ok) throw new Error('Saisonabschluss konnte nicht bestätigt werden.');
      window.alert(`${data.season_name || preview.season.name} wurde erfolgreich abgeschlossen und archiviert.`);
      window.location.reload();
    } catch (error) {
      console.error(error);
      const feedback = document.getElementById('season-feedback');
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = error.message || 'Saisonabschluss fehlgeschlagen.';
        feedback.classList.add('notice-error');
      } else {
        window.alert(error.message || 'Saisonabschluss fehlgeschlagen.');
      }
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function init() {
    if (initialized) return;
    const context = await window.RCCData?.getLeagueContext?.({ forceRefresh: true }).catch(() => null);
    if (!context?.leagueId || !['owner','admin'].includes(context.role)) return;
    const button = document.getElementById('finalize-season-btn');
    if (!button) return;
    button.addEventListener('click', finalize, { capture: true });
    initialized = true;
  }

  window.RCCSeasonFinalize = { init, buildPreview };
})();
