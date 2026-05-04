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

function bindArchiveActions() {
  const selectEl = document.getElementById('archive-season-select');
  const openBtn = document.getElementById('archive-open-btn');
  const hintEl = document.getElementById('archive-season-hint');
  if (!selectEl || !openBtn) return;

  const updateState = () => {
    const hasSeason = Boolean(selectEl.value);
    openBtn.disabled = !hasSeason;
    if (hintEl) {
      hintEl.textContent = hasSeason
        ? `Ausgewählt: ${selectEl.options[selectEl.selectedIndex]?.textContent || 'Saison'}`
        : 'Bitte eine abgeschlossene Saison auswählen.';
    }
  };

  const openArchive = () => {
    if (!selectEl.value) return;
    window.location.href = `saison-archiv.html?season=${encodeURIComponent(selectEl.value)}`;
  };

  selectEl.addEventListener('change', updateState);
  openBtn.addEventListener('click', openArchive);
  updateState();
}

async function loadSeasonArchiveSelector() {
  const selectEl = document.getElementById('archive-season-select');
  const hintEl = document.getElementById('archive-season-hint');
  if (!selectEl) return;

  try {
    const seasons = await window.RCCData.fetchSeasons({ archivedOnly: true });
    if (!seasons.length) {
      selectEl.innerHTML = '<option value="">Keine abgeschlossenen Saisons vorhanden</option>';
      if (hintEl) hintEl.textContent = 'Sobald eine Saison abgeschlossen ist, erscheint sie hier automatisch.';
      return;
    }

    selectEl.innerHTML = `
      <option value="">Bitte Saison wählen</option>
      ${seasons.map((season) => `<option value="${window.escapeHtml(String(season.id))}">${window.escapeHtml(season.name || `Saison ${season.id}`)}</option>`).join('')}
    `;
  } catch (error) {
    console.error(error);
    selectEl.innerHTML = '<option value="">Archiv konnte nicht geladen werden</option>';
    if (hintEl) hintEl.textContent = 'Fehler beim Laden des Archivs.';
  }
}


function highlightRaceFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const targetRound = params.get('round');
  const targetSeason = params.get('season');
  if (!targetRound) return;

  const cardLink = document.querySelector(`.race-card-link[data-race-round="${CSS.escape(targetRound)}"]${targetSeason ? `[data-race-season="${CSS.escape(targetSeason)}"]` : ''}`)
    || document.querySelector(`.race-card-link[data-race-round="${CSS.escape(targetRound)}"]`);
  if (!cardLink) return;

  const upcomingBtn = document.querySelector('.calendar-toggle[data-target="upcoming-section"]');
  if (upcomingBtn) upcomingBtn.click();

  cardLink.classList.add('race-card-link-highlight');
  cardLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => cardLink.classList.remove('race-card-link-highlight'), 2400);
}

async function loadCalendar() {
  const upcomingContainer = document.getElementById('upcoming-races');
  const completedContainer = document.getElementById('completed-races');

  if (upcomingContainer) upcomingContainer.innerHTML = '<div class="notice">Rennen werden geladen...</div>';
  if (completedContainer) completedContainer.innerHTML = '<div class="notice">Rennen werden geladen...</div>';

  try {
    const season = await window.RCCData.fetchCurrentSeason();
    const races = await window.RCCData.fetchRaces({ seasonId: season?.id });

    const stewardByRace = new Map();
    const raceIds = races.map((race) => race.id).filter(Boolean);
    if (raceIds.length) {
      const stewardResponse = await window.supabaseClient
        .from('steward_cases')
        .select('race_id')
        .in('race_id', raceIds);

      if (!stewardResponse.error) {
        (stewardResponse.data || []).forEach((entry) => {
          if (!entry?.race_id) return;
          const existing = stewardByRace.get(entry.race_id) || 0;
          stewardByRace.set(entry.race_id, existing + 1);
        });
      }
    }

    const racesWithLifecycle = races.map((race) => ({
      ...race,
      steward_count: stewardByRace.get(race.id) || 0,
      status: window.getRaceLifecycleStatus ? window.getRaceLifecycleStatus(race) : race.status
    }));

    const upcoming = racesWithLifecycle.filter((race) => race.status === 'upcoming');
    const completed = racesWithLifecycle
      .filter((race) => race.status === 'completed')
      .sort((a, b) => Number(b.round_number || 0) - Number(a.round_number || 0));

    if (upcomingContainer) upcomingContainer.innerHTML = upcoming.length ? upcoming.map(window.createRaceCard).join('') : '<div class="notice">Keine kommenden Rennen vorhanden.</div>';
    if (completedContainer) completedContainer.innerHTML = completed.length ? completed.map(window.createRaceCard).join('') : '<div class="notice">Noch keine Rennen gefahren.</div>';
    highlightRaceFromQuery();
  } catch (error) {
    console.error(error);
    if (upcomingContainer) upcomingContainer.innerHTML = '<div class="notice">Fehler beim Laden der Rennen.</div>';
    if (completedContainer) completedContainer.innerHTML = '<div class="notice">Fehler beim Laden der Rennen.</div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindCalendarToggles();
  bindArchiveActions();
  loadSeasonArchiveSelector();
  loadCalendar();
});
