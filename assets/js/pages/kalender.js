function bindCalendarToggles() {
  const buttons = [...document.querySelectorAll('.calendar-toggle')];
  const sections = [...document.querySelectorAll('.calendar-section')];
  if (!buttons.length || !sections.length) return;

  const activate = (targetId) => {
    buttons.forEach((button) => {
      const active = button.dataset.target === targetId;
      button.classList.toggle('primary', active);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    sections.forEach((section) => section.classList.toggle('hidden-section', section.id !== targetId));
  };

  buttons.forEach((button) => button.addEventListener('click', () => activate(button.dataset.target)));
  activate(document.querySelector('.calendar-toggle.active')?.dataset.target || 'upcoming-section');
}

async function loadCalendar() {
  const upcomingContainer = document.getElementById('upcoming-races');
  const completedContainer = document.getElementById('completed-races');

  if (upcomingContainer) upcomingContainer.innerHTML = '<div class="notice">Rennen werden geladen...</div>';
  if (completedContainer) completedContainer.innerHTML = '<div class="notice">Rennen werden geladen...</div>';

  try {
    const season = await window.RCCData.fetchCurrentSeason();
    const [races, stewardResponse] = await Promise.all([
      window.RCCData.fetchRaces({ seasonId: season?.id }),
      window.supabaseClient
        .from('steward_cases')
        .select('race_id, decision_text, created_at')
        .order('created_at', { ascending: false })
    ]);

    const stewardByRace = new Map();
    if (!stewardResponse.error) {
      (stewardResponse.data || []).forEach((entry) => {
        if (!entry?.race_id) return;
        if (!stewardByRace.has(entry.race_id)) {
          stewardByRace.set(entry.race_id, { count: 0, latestDecision: '' });
        }
        const raceStewardData = stewardByRace.get(entry.race_id);
        raceStewardData.count += 1;
        if (!raceStewardData.latestDecision && entry.decision_text) {
          const normalizedDecision = String(entry.decision_text).trim();
          raceStewardData.latestDecision = normalizedDecision.length > 80 ? `${normalizedDecision.slice(0, 77)}…` : normalizedDecision;
        }
      });
    }

    const racesWithLifecycle = races.map((race) => ({
      ...race,
      steward_count: stewardByRace.get(race.id)?.count || 0,
      latest_steward_decision: stewardByRace.get(race.id)?.latestDecision || '',
      status: window.getRaceLifecycleStatus ? window.getRaceLifecycleStatus(race) : race.status
    }));

    const upcoming = racesWithLifecycle.filter((race) => race.status === 'upcoming');
    const completed = racesWithLifecycle
      .filter((race) => race.status === 'completed')
      .sort((a, b) => Number(b.round_number || 0) - Number(a.round_number || 0));

    if (upcomingContainer) upcomingContainer.innerHTML = upcoming.length ? upcoming.map(window.createRaceCard).join('') : '<div class="notice">Keine kommenden Rennen vorhanden.</div>';
    if (completedContainer) completedContainer.innerHTML = completed.length ? completed.map(window.createRaceCard).join('') : '<div class="notice">Noch keine Rennen gefahren.</div>';
  } catch (error) {
    console.error(error);
    if (upcomingContainer) upcomingContainer.innerHTML = '<div class="notice">Fehler beim Laden der Rennen.</div>';
    if (completedContainer) completedContainer.innerHTML = '<div class="notice">Fehler beim Laden der Rennen.</div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindCalendarToggles();
  loadCalendar();
});
