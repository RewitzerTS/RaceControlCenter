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
    const races = await window.RCCData.fetchRaces({ seasonId: season?.id });

    const upcoming = races.filter((race) => race.status === 'upcoming');
    const completed = races.filter((race) => race.status === 'completed').sort((a, b) => Number(b.round_number || 0) - Number(a.round_number || 0));

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
