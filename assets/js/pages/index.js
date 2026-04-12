function renderChampions(currentSeason, latestHistory) {
  const driverChampionEl = document.getElementById('current-driver-champion');
  const constructorChampionEl = document.getElementById('current-constructor-champion');
  const seasonLabelEl = document.getElementById('current-season-label');

  if (seasonLabelEl) seasonLabelEl.textContent = currentSeason?.name || latestHistory?.seasons?.name || 'Aktuelle Saison';
  if (driverChampionEl) driverChampionEl.textContent = latestHistory?.driver_champion || 'Noch offen';
  if (constructorChampionEl) constructorChampionEl.textContent = latestHistory?.constructor_champion || 'Noch offen';
}

async function loadDashboard() {
  const totalRacesEl = document.getElementById('stat-total-races');
  const upcomingRacesEl = document.getElementById('stat-upcoming-races');
  const completedRacesEl = document.getElementById('stat-completed-races');

  try {
    const currentSeason = await window.RCCData.fetchCurrentSeason();
    const [races, history] = await Promise.all([
      window.RCCData.fetchRaces({ seasonId: currentSeason?.id }),
      window.RCCData.fetchSeasonHistory(1)
    ]);

    const upcoming = races.filter((race) => race.status === 'upcoming');
    const completed = races.filter((race) => race.status === 'completed');

    if (totalRacesEl) totalRacesEl.textContent = races.length;
    if (upcomingRacesEl) upcomingRacesEl.textContent = upcoming.length;
    if (completedRacesEl) completedRacesEl.textContent = completed.length;

    renderChampions(currentSeason, history[0]);
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);


const WEEKLY_F1_FACTS = [
  'Der engste bekannte Zieleinlauf der Formel-1-Geschichte lag 1971 in Monza bei nur 0,01 Sekunden zwischen Sieger Peter Gethin und Ronnie Peterson.',
  'Beim Grand Prix von Europa 1997 in Jerez trennten Jacques Villeneuve, Michael Schumacher und Heinz-Harald Frentzen im Qualifying exakt dieselbe Zeit bis auf die Tausendstel.',
  'Honda baute 1965 für Mexiko einen eigenen 1,5-Liter-V12, obwohl viele Rivalen mit deutlich kompakteren Motoren unterwegs waren.',
  'Niki Lauda gewann 1984 den Titel mit nur einem halben Punkt Vorsprung – dem kleinsten WM-Abstand in der Formel-1-Geschichte.',
  'Im ersten WM-Lauf 1950 in Silverstone bestand das Podium komplett aus Alfa Romeo, und alle drei Fahrer waren über 46 Jahre alt.',
  'Der Lotus 88 mit Doppelfahrwerk fuhr 1981 praktisch nie ein Rennen, obwohl sein Konzept so radikal war, dass es die Konkurrenz alarmierte.',
  'Kimi Räikkönen gewann 2012 in Abu Dhabi bei seinem Comeback – und funkte mitten im Rennen das berühmte „Leave me alone“.',
  'Der Regenreifenwechsel in Monaco 1997 machte aus Olivier Panis kurzzeitig einen echten Sieganwärter, obwohl Prost sonst oft im Hinterfeld fuhr.'
];

function renderWeeklyStoryline() {
  const el = document.getElementById('hero-storyline');
  if (!el) return;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const week = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));
  el.textContent = WEEKLY_F1_FACTS[week % WEEKLY_F1_FACTS.length];
}

document.addEventListener('DOMContentLoaded', renderWeeklyStoryline);
