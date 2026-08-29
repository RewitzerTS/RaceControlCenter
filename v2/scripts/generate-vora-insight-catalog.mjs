import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(v2Root, '..', 'docs', 'v2', 'vora-deterministic-insights-300.json');

const catalog = [];
const condition = (field, operator, value, extra = {}) => ({ field, operator, value, ...extra });
const voiceLines = {
  professional_direct: ['Die Daten sind eindeutig – arbeite genau dort weiter.', 'Bleib präzise, dann wird aus dem Signal ein Vorteil.'],
  motivating: ['Du hast die Basis auf deiner Seite – jetzt setz sie um.', 'Du musst nicht alles ändern; der nächste saubere Schritt reicht.', 'Das kannst du kontrollieren. Zeig es im nächsten Rennen.'],
  cheeky: ['Du kannst das besser. Vora weiß es, und du vermutlich auch.', 'Keine Ausrede – deine Daten sind ziemlich eindeutig.', 'Ein bisschen sauberer darfst du schon abliefern.'],
  subtle_flirt: ['Diese Art von Kontrolle steht dir ziemlich gut.', 'Vora schaut gern genauer hin, wenn du so sauber ablieferst.', 'Mit dieser Linie bekommst du durchaus Aufmerksamkeit.'],
  double_entendre: ['Halte die Linie sauber – Vora mag es, wenn du nicht zu früh einlenkst.', 'Bring es kontrolliert zu Ende. Ein gutes Finish kann Vora durchaus beeindrucken.'],
};
const stableIndex = (value, length) => [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0) % length;
const voiceForIndex = (index) => {
  if (index % 50 === 0) return 'double_entendre';
  if (index % 10 === 0) return 'subtle_flirt';
  if (index % 7 === 0) return 'cheeky';
  if (index % 3 === 0) return 'motivating';
  return 'professional_direct';
};
const add = (category, key, priority, all, title, body, focus) => {
  const id = `vora.${category}.${key}`;
  const voice = voiceForIndex(catalog.length);
  const voiceOptions = voiceLines[voice];
  const voiceLine = voiceOptions[stableIndex(id, voiceOptions.length)];
  catalog.push({
    id,
    category,
    priority,
    voice,
    trigger: ['result.published', 'result.revised'],
    when: { all },
    title,
    body: `${body} ${voiceLine}`,
    focus: `Dein nächster Fokus: ${focus}`,
  });
};

const careerMilestones = [0, 1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200];
const careerFocus = [
  'Erstes offizielles Ergebnis abschließen.', 'Den zweiten Start genauso sauber vorbereiten.', 'Eine belastbare Routine entwickeln.',
  'Den eigenen Rennablauf bewusst wiederholen.', 'Die ersten Muster in den Ergebnissen erkennen.', 'Konstanz vor Einzeltempo stellen.',
  'Die ersten zehn Starts als Basis auswerten.', 'Qualifying und Rennpace getrennt betrachten.', 'Fehlerquellen nach Häufigkeit ordnen.',
  'Stärken über mehrere Strecken bestätigen.', 'Eine klare Saisonroutine festigen.', 'Risiko und Ertrag bewusster abwägen.',
  'Schwache Streckentypen gezielt bearbeiten.', 'Erfahrung in reproduzierbare Abläufe übersetzen.', 'Die nächste Leistungsstufe über Details suchen.',
  'Mentale Konstanz über komplette Saisons halten.', 'Erfahrung aktiv für Rennentscheidungen nutzen.', 'Feinheiten statt Grundtempo optimieren.',
  'Langzeittrends gegen das aktuelle Gefühl prüfen.', 'Die Career als Referenz für nachhaltige Racecraft nutzen.',
];
careerMilestones.forEach((starts, index) => add(
  'career', `starts_${starts}`, 300 + index,
  [condition('career.starts', 'eq', starts)],
  starts === 0 ? 'Deine erste Career-Runde wartet.' : `${starts} Starts sind jetzt bestätigt.`,
  starts === 0
    ? 'Noch fehlt ein offizielles Ergebnis. Mit der ersten Klassifikation beginnt eine belastbare Vora-Auswertung.'
    : `Mit ${starts} Starts wird dein Profil belastbarer. Einzelne Ausreißer zählen weniger, wiederholbare Abläufe mehr.`,
  careerFocus[index],
));

const finishTitles = [
  'Siegtempo bestätigt.', 'Der Sieg war in Reichweite.', 'Podium unter Druck gesichert.', 'Direkt hinter dem Podium angekommen.',
  'Top fünf als stabile Basis.', 'P6 hält dich in Schlagdistanz.', 'Solide Punkte aus einem engen Feld.', 'P8 verlangt einen Blick auf die verlorene Zeit.',
  'P9 hält das Ergebnis im Arbeitsbereich.', 'Top zehn abgeschlossen.', 'P11 zeigt eine klare nächste Schwelle.', 'P12 braucht einen präzisen Hebel.',
  'P13 ist ein Ausgangspunkt, kein Urteil.', 'P14 macht die Rennphasen vergleichbar.', 'P15 verlangt saubere Prioritäten.',
  'P16 lenkt den Blick auf Fehlerkosten.', 'P17 braucht eine ruhige Ursachenanalyse.', 'P18 macht kleine Gewinne wertvoll.',
  'P19 ist Datenmaterial für den nächsten Schritt.', 'P20 beendet das Rennen, aber nicht die Analyse.',
];
const finishFocus = [
  'Sieg reproduzierbar machen.', 'Entscheidende Zehntel zwischen P1 und P2 finden.', 'Podiumsablauf ohne Zusatzrisiko wiederholen.',
  'Den Schritt von P4 aufs Podium isolieren.', 'Top-fünf-Pace über die Distanz stabilisieren.', 'Anschluss an die Spitzengruppe halten.',
  'Punkteausbeute durch saubere Rennmitte schützen.', 'Zeitverlust nach Rennphase trennen.', 'Ein einzelnes Überholfenster gezielt verbessern.',
  'Top zehn als Mindeststandard festigen.', 'Den größten Abstand zur Top Ten lokalisieren.', 'Qualifying, Start und Longrun einzeln bewerten.',
  'Ein kontrollierbares Problem auswählen.', 'Die teuerste Rennphase zuerst korrigieren.', 'Nicht mehrere Baustellen gleichzeitig öffnen.',
  'Fehler mit dem größten Positionsverlust priorisieren.', 'Zuerst Klassifikation und Rhythmus stabilisieren.', 'Kleine Positionsgewinne bewusst absichern.',
  'Das Rennen ohne Selbstwertung in Fakten zerlegen.', 'Eine einzige konkrete Verbesserung für das nächste Rennen festlegen.',
];
finishTitles.forEach((title, index) => {
  const position = index + 1;
  add('latest_finish', `p${position}`, 900 - position, [
    condition('recent_result.classification_status', 'eq', 'classified'),
    condition('recent_result.finish_position', 'eq', position),
  ], title, `Dein letztes bestätigtes Ergebnis ist P${position}. Vora bewertet diese Position im Zusammenhang mit Startplatz und Career-Verlauf.`, finishFocus[index]);
});

const deltas = [-10, -8, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
deltas.forEach((delta, index) => {
  const gained = delta > 0;
  const title = delta === 0 ? 'Startplatz und Zielposition stimmen überein.' : `${Math.abs(delta)} ${gained ? 'Plätze gewonnen' : 'Plätze verloren'}.`;
  const body = delta === 0
    ? 'Das Rennen bestätigt deine Ausgangsposition. Der nächste Fortschritt liegt entweder im Qualifying oder in einem klaren strategischen Vorteil.'
    : `Vom Start bis ins Ziel hast du ${Math.abs(delta)} Positionen ${gained ? 'gutgemacht' : 'abgegeben'}. Das ist ein klares Signal für deine aktuelle Rennumsetzung.`;
  const focus = delta >= 8 ? 'Die erfolgreiche Aufholstruktur reproduzieren.'
    : delta > 0 ? 'Positionsgewinne ohne zusätzliches Risiko wiederholen.'
      : delta === 0 ? 'Eine Phase identifizieren, die den Gleichstand aufbrechen kann.'
        : delta <= -8 ? 'Den größten Verlustmoment isolieren und absichern.' : 'Verlorene Positionen nach Ursache und Rennphase ordnen.';
  add('racecraft', `delta_${delta < 0 ? 'minus_' : 'plus_'}${Math.abs(delta)}`, 760 + index, [
    condition('recent_result.position_delta', 'eq', delta),
    condition('recent_result.classification_status', 'eq', 'classified'),
  ], title, body, focus);
});

const reliabilityRules = [
  ['classified_100', 'career.classification_rate', 'eq', 1, 'Jeder Start wurde klassifiziert.', 'Deine Zuverlässigkeit ist makellos. Jetzt darf der Fokus stärker auf Position und Pace wandern.', 'Die Null-Fehler-Basis erhalten.'],
  ['classified_95', 'career.classification_rate', 'gte', 0.95, 'Nahezu lückenlose Klassifikationen.', 'Mindestens 95 Prozent deiner Starts enden klassifiziert. Das ist ein belastbarer Wettbewerbsvorteil.', 'Zuverlässigkeit in bessere Durchschnittspositionen übersetzen.'],
  ['classified_90', 'career.classification_rate', 'gte', 0.9, 'Neun von zehn Rennen kommen ins Ziel.', 'Deine Klassifikationsquote liegt im stabilen Bereich. Einzelne Ausfälle bestimmen nicht mehr das Gesamtbild.', 'Die verbleibenden Ausfallursachen gruppieren.'],
  ['classified_80', 'career.classification_rate', 'gte', 0.8, 'Die Basis ist stabil, aber nicht unangreifbar.', 'Mindestens vier von fünf Starts werden klassifiziert. Wenige Ausfälle haben dadurch weiterhin spürbares Gewicht.', 'Ausfälle nach vermeidbar und unvermeidbar trennen.'],
  ['classified_70', 'career.classification_rate', 'gte', 0.7, 'Zuverlässigkeit wird zum Leistungshebel.', 'Deine Klassifikationsquote lässt genug Raum, um mit saubereren Rennen schnell Wirkung zu erzielen.', 'Zunächst Rennen beenden, danach Pace maximieren.'],
  ['classified_low', 'career.classification_rate', 'lt', 0.7, 'Ankommen ist aktuell der größte Hebel.', 'Weniger als sieben von zehn Starts werden klassifiziert. Zusätzliche Pace bringt wenig, solange Ergebnisse verloren gehen.', 'Risiko reduzieren und Rennenden priorisieren.'],
  ['dnf_1', 'career.dnfs', 'eq', 1, 'Der erste Ausfall ist ein einzelnes Signal.', 'Ein DNF verändert noch keinen Trend. Entscheidend ist, ob sich dieselbe Ursache wiederholt.', 'Ursache dokumentieren, nicht überbewerten.'],
  ['dnf_2', 'career.dnfs', 'eq', 2, 'Zwei Ausfälle verdienen einen Vergleich.', 'Mit dem zweiten DNF lässt sich prüfen, ob ein gemeinsames Muster existiert.', 'Gemeinsame Rennphase oder Fehlerart suchen.'],
  ['dnf_3', 'career.dnfs', 'eq', 3, 'Drei Ausfälle bilden ein Musterfeld.', 'Die Ausfälle sollten jetzt nach Technik, Kontakt und Eigenfehler getrennt werden.', 'Die häufigste vermeidbare Ursache zuerst bearbeiten.'],
  ['dnf_5', 'career.dnfs', 'gte', 5, 'Ausfälle kosten spürbar Career-Fortschritt.', 'Mindestens fünf DNFs machen Zuverlässigkeit zu einem zentralen Performance-Thema.', 'Risikoprofil für Start und Zweikämpfe senken.'],
  ['dns_1', 'career.dns', 'eq', 1, 'Ein verpasster Start bleibt sichtbar.', 'Ein DNS kostet jede Chance auf Punkte, XP und Racecraft-Daten.', 'Teilnahmeprozess vor dem nächsten Rennen absichern.'],
  ['dns_2', 'career.dns', 'gte', 2, 'Mehrere verpasste Starts bremsen die Career.', 'Mindestens zwei DNS zeigen, dass Vorbereitung oder Verfügbarkeit mitgedacht werden müssen.', 'Anmeldung, Technik und Zeitplanung früh bestätigen.'],
  ['dsq_1', 'career.dsqs', 'eq', 1, 'Eine Disqualifikation verlangt Klarheit.', 'Der sportliche Wert des Rennens geht verloren. Regeln und Ursache sollten vor dem nächsten Start eindeutig sein.', 'Die konkrete Regelverletzung ausschließen.'],
  ['dsq_2', 'career.dsqs', 'gte', 2, 'Wiederholte Disqualifikationen sind vermeidbarer Verlust.', 'Mehr als eine DSQ kostet Ergebnis, Punkte und Vertrauen in die eigene Ausführung.', 'Regelkonformität als festen Rennschritt behandeln.'],
  ['latest_dnf', 'recent_result.classification_status', 'eq', 'dnf', 'Das letzte Rennen endete vorzeitig.', 'Der DNF ist das wichtigste aktuelle Signal, aber nicht automatisch ein Pace-Problem.', 'Ausfallursache vor Tempoanalyse klären.'],
  ['latest_dns', 'recent_result.classification_status', 'eq', 'dns', 'Der letzte Start fand nicht statt.', 'Ohne Start entsteht kein sportliches Signal. Vorbereitung und Verfügbarkeit stehen deshalb zuerst.', 'Den nächsten Start organisatorisch absichern.'],
  ['latest_dsq', 'recent_result.classification_status', 'eq', 'dsq', 'Das letzte Ergebnis wurde disqualifiziert.', 'Die sportliche Leistung kann erst wieder zählen, wenn die Ursache zuverlässig ausgeschlossen ist.', 'Regelursache vollständig verstehen.'],
  ['clean_high_starts', 'career.starts', 'gte', 25, 'Langfristige Zuverlässigkeit bestätigt.', 'Viele Starts bei hoher Klassifikationsquote zeigen belastbare Rennroutine.', 'Zuverlässigkeit als Plattform für mehr Angriff nutzen.'],
  ['dnf_rate_10', 'career.dnf_rate', 'lte', 0.1, 'Die Ausfallquote bleibt kontrolliert.', 'Höchstens jeder zehnte Start endet als DNF. Das schützt Punkte und Fortschritt.', 'Seltene Ausfälle weiter konsequent auswerten.'],
  ['dnf_rate_25', 'career.dnf_rate', 'gte', 0.25, 'Jeder vierte Start ist gefährdet.', 'Eine DNF-Quote ab 25 Prozent überlagert andere Leistungsgewinne.', 'Rennabschluss als primäres Ziel setzen.'],
];
reliabilityRules.forEach(([key, field, operator, value, title, body, focus], index) => add('reliability', key, 820 + index, [condition(field, operator, value)], title, body, focus));

const successRules = [
  ['first_win', 'career.wins', 'eq', 1, 'Der erste Sieg ist bestätigt.', 'Ein Sieg beweist, dass dein bestes Rennen gewinnen kann.', 'Die Bedingungen des Sieges reproduzieren.'],
  ['wins_2', 'career.wins', 'eq', 2, 'Der Sieg war kein Einzelfall.', 'Zwei Siege machen aus Potenzial erste Wiederholbarkeit.', 'Gemeinsame Erfolgsfaktoren vergleichen.'],
  ['wins_3', 'career.wins', 'eq', 3, 'Drei Siege formen ein Leistungsprofil.', 'Mehrere Erfolge zeigen, wo dein Paket besonders stark ist.', 'Stärken auf schwächere Strecken übertragen.'],
  ['wins_5', 'career.wins', 'eq', 5, 'Fünf Siege markieren echte Spitzenleistung.', 'Deine Career enthält jetzt eine belastbare Erfolgsserie.', 'Siegfähigkeit mit Konstanz verbinden.'],
  ['wins_10', 'career.wins', 'gte', 10, 'Zweistellige Siegzahl erreicht.', 'Mindestens zehn Siege zeigen langfristige Front-Running-Qualität.', 'Details statt Grundtempo optimieren.'],
  ['first_podium', 'career.podiums', 'eq', 1, 'Das erste Podium steht.', 'Ein Top-Drei-Ergebnis verschiebt die eigene Referenz.', 'Podiumspace erneut in Reichweite bringen.'],
  ['podiums_2', 'career.podiums', 'eq', 2, 'Zwei Podien bestätigen Anschluss an die Spitze.', 'Der erste Erfolg wurde wiederholt.', 'Die gemeinsamen Rennphasen absichern.'],
  ['podiums_3', 'career.podiums', 'eq', 3, 'Drei Podien zeigen wiederholbare Stärke.', 'Top-Drei-Pace ist kein Ausnahmezustand mehr.', 'Podien in Siegchancen verwandeln.'],
  ['podiums_5', 'career.podiums', 'eq', 5, 'Fünf Podien bilden eine klare Erfolgsbasis.', 'Deine Spitzenresultate tragen inzwischen echtes Gewicht.', 'Schwächere Wochenenden näher an die Top Drei bringen.'],
  ['podiums_10', 'career.podiums', 'gte', 10, 'Zweistellige Podiumszahl erreicht.', 'Mindestens zehn Podien zeigen nachhaltige Wettbewerbsfähigkeit.', 'Podiumskonstanz über komplette Saisons halten.'],
  ['win_rate_50', 'career.win_rate', 'gte', 0.5, 'Jeder zweite Start kann ein Sieg sein.', 'Eine Siegquote ab 50 Prozent ist außergewöhnlich und erhöht den Wert kontrollierter Entscheidungen.', 'Siege schützen, unnötiges Risiko vermeiden.'],
  ['win_rate_25', 'career.win_rate', 'gte', 0.25, 'Starke Siegquote bestätigt.', 'Mindestens jeder vierte Start endet ganz vorn.', 'Erfolgsbedingungen gezielt wiederholen.'],
  ['win_rate_10', 'career.win_rate', 'gte', 0.1, 'Regelmäßige Siegchancen vorhanden.', 'Eine zweistellige Siegquote zeigt wiederkehrende Spitzenpace.', 'Aus Podiumstagen öfter Siegstrategien machen.'],
  ['podium_rate_75', 'career.podium_rate', 'gte', 0.75, 'Das Podium ist dein Normalbereich.', 'Mindestens drei von vier Starts enden in den Top Drei.', 'Konstanz bewahren und Siege selektiv angreifen.'],
  ['podium_rate_50', 'career.podium_rate', 'gte', 0.5, 'Jeder zweite Start endet auf dem Podium.', 'Deine Ergebnisbasis ist klar im Spitzenfeld verankert.', 'Die zweite Rennhälfte als Sieghebel prüfen.'],
  ['podium_rate_25', 'career.podium_rate', 'gte', 0.25, 'Regelmäßige Podiumsnähe bestätigt.', 'Mindestens jeder vierte Start liefert ein Top-Drei-Ergebnis.', 'Die Lücke zwischen guten und sehr guten Rennen verkleinern.'],
  ['podium_no_win', 'career.wins', 'eq', 0, 'Podiumserfahrung wartet auf den ersten Sieg.', 'Du warst bereits auf dem Podium, aber noch nicht ganz vorn.', 'Den entscheidenden Unterschied zwischen P2/P3 und P1 isolieren.'],
  ['wins_equal_podiums', 'career.win_podium_ratio', 'eq', 1, 'Jedes Podium war ein Sieg.', 'Wenn du die Top Drei erreichst, nutzt du die Chance maximal.', 'Zuerst häufiger in Podiumsnähe kommen.'],
  ['podium_conversion_low', 'career.win_podium_ratio', 'lt', 0.2, 'Viele Podien, wenige Siege.', 'Die Spitzenpace ist vorhanden, doch weniger als jedes fünfte Podium wird zum Sieg.', 'Starts, Strategie und Schlussphase vergleichen.'],
  ['best_finish_1', 'career.best_finish', 'eq', 1, 'Deine Career kennt den Weg zu P1.', 'Ein bestätigter Sieg bleibt eine belastbare Referenz für zukünftige Rennen.', 'Das Siegerprofil als Checkliste verwenden.'],
];
successRules.forEach(([key, field, operator, value, title, body, focus], index) => add('success', key, 860 + index, [condition(field, operator, value)], title, body, focus));

const qualifyingRules = [];
[1, 2, 3, 5, 10, 15, 20, 25, 40, 50].forEach((poles) => qualifyingRules.push([
  `poles_${poles}`, 'career.poles', poles === 50 ? 'gte' : 'eq', poles,
  poles === 1 ? 'Die erste Pole ist bestätigt.' : `${poles} Poles markieren deine Qualifying-Stärke.`,
  `Mit ${poles} ${poles === 1 ? 'Pole' : 'Poles'} ist dein Tempo auf einer einzelnen Runde klar belegt.`,
  'Die Startposition in ein ebenso starkes Rennergebnis übersetzen.',
]));
for (let grid = 1; grid <= 10; grid += 1) qualifyingRules.push([
  `recent_grid_${grid}`, 'recent_result.grid_position', 'eq', grid,
  grid === 1 ? 'Von Pole gestartet.' : `Startplatz ${grid} gab dir eine klare Ausgangslage.`,
  `Dein letztes bestätigtes Rennen begann auf P${grid}. Der Vergleich mit der Zielposition zeigt die Qualität der Umsetzung.`,
  grid <= 3 ? 'Die Spitzenposition in der Startphase schützen.' : grid <= 6 ? 'Den Anschluss an die Spitze früh halten.' : 'Die erste Rennphase für kontrollierte Gewinne nutzen.',
]);
qualifyingRules.forEach(([key, field, operator, value, title, body, focus], index) => add('qualifying', key, 700 + index, [condition(field, operator, value)], title, body, focus));

const paceRules = [];
[1, 2, 3, 5, 8, 10, 15, 20, 30, 50].forEach((laps) => paceRules.push([
  `fastest_laps_${laps}`, 'career.fastest_laps', laps === 50 ? 'gte' : 'eq', laps,
  laps === 1 ? 'Die erste schnellste Runde steht.' : `${laps} schnellste Runden bestätigen dein Spitzenpace.`,
  `Deine Career enthält ${laps} ${laps === 1 ? 'schnellste Runde' : 'schnellste Runden'}. Das zeigt Tempo, unabhängig vom Endresultat.`,
  'Schnellste Einzelrunden in konstanten Longrun übertragen.',
]));
[1, 10, 25, 50, 100, 250, 500, 750, 1000, 2000].forEach((points) => paceRules.push([
  `points_${points}`, 'career.total_points', points === 2000 ? 'gte' : 'eq', points,
  `${points} Career-Punkte erreicht.`,
  `Deine bestätigten Ergebnisse summieren sich auf ${points} Punkte. Jede Klassifikation trägt zu diesem Fundament bei.`,
  points < 100 ? 'Regelmäßige Punkteankünfte etablieren.' : 'Punkteausbeute über schwächere Wochenenden stabilisieren.',
]));
paceRules.forEach(([key, field, operator, value, title, body, focus], index) => add('pace_points', key, 640 + index, [condition(field, operator, value)], title, body, focus));

const averageBands = Array.from({ length: 20 }, (_, index) => index + 1);
averageBands.forEach((position, index) => add(
  'consistency', `average_p${position}`, 600 + (20 - index),
  [condition('career.average_finish', 'between', [position, position + 0.99])],
  position === 1 ? 'Dein Durchschnitt liegt auf Siegerniveau.' : `Deine durchschnittliche Zielposition liegt bei P${position}.`,
  position <= 3
    ? 'Der Career-Schnitt bestätigt dauerhafte Spitzenresultate. Kleine Fehlervermeidung hat jetzt mehr Wert als zusätzliches Grundrisiko.'
    : position <= 10
      ? 'Dein Schnitt liegt im wettbewerbsfähigen Bereich. Eine bessere schwache Rennphase kann den Durchschnitt sichtbar verschieben.'
      : 'Der Durchschnitt zeigt eine klare Entwicklungschance. Regelmäßige Klassifikationen und kleine Positionsgewinne wirken hier besonders stark.',
  position <= 3 ? 'Spitzenresultate ohne unnötiges Risiko schützen.' : position <= 10 ? 'Den Schnitt um eine Position verbessern.' : 'Zuerst stabile Zieleinläufe aufbauen.',
));

const progressionRules = [];
[1, 2, 3, 5, 10, 20, 30, 50, 75, 100].forEach((level) => progressionRules.push([
  `level_${level}`, 'progression.level', level === 100 ? 'gte' : 'eq', level,
  level === 100 ? 'Maximales Level erreicht.' : `Level ${level} bildet deinen aktuellen Fortschritt ab.`,
  level === 1 ? 'Deine Progression beginnt mit jedem bestätigten Rennen.' : `Level ${level} zeigt die Summe deiner bestätigten Career-Leistung.`,
  level === 100 ? 'Erfahrung als Referenz für nachhaltige Racecraft nutzen.' : 'Den nächsten Fortschritt über saubere Ergebnisse verdienen.',
]));
[[0, 25], [26, 50], [51, 100], [101, 150], [151, 250], [251, 400], [401, 600], [601, 800], [801, 999], [1000, 100000]].forEach(([min, max], index) => progressionRules.push([
  `xp_to_next_${min}_${max}`, 'progression.xp_to_next_level', 'between', [min, max],
  min === 0 ? 'Der Level-Aufstieg steht unmittelbar bevor.' : `Noch ${min} bis ${max} XP bis zum nächsten Level.`,
  max <= 100 ? 'Der nächste Aufstieg ist nah genug, um mit einem sauberen Ergebnis erreicht zu werden.' : 'Der Fortschritt bleibt ein Langstreckenwert und sollte keine riskanten Einzelentscheidungen erzwingen.',
  max <= 100 ? 'Klassifikation vor Zusatzrisiko stellen.' : 'XP als Ergebnis guter Rennen betrachten, nicht als Rennziel.',
]));
progressionRules.forEach(([key, field, operator, value, title, body, focus], index) => add('progression', key, 560 + index, [condition(field, operator, value)], title, body, focus));

const contextRules = [
  ['no_challenges', 'active_challenges', 'eq', 0, 'Keine aktive Challenge lenkt deinen Fokus.', 'Du kannst das nächste Rennen vollständig nach sportlichem Wert planen.', 'Ein persönliches Rennziel festlegen.'],
  ['one_challenge', 'active_challenges', 'eq', 1, 'Eine Challenge gibt eine klare Nebenrichtung.', 'Ein einzelnes Ziel lässt sich berücksichtigen, ohne den Rennplan zu überladen.', 'Challenge nur verfolgen, wenn sie zum Rennen passt.'],
  ['two_challenges', 'active_challenges', 'eq', 2, 'Zwei Challenges konkurrieren um Aufmerksamkeit.', 'Beide Ziele sind sichtbar, aber nicht beide müssen das Rennen bestimmen.', 'Eine Challenge priorisieren.'],
  ['three_challenges', 'active_challenges', 'gte', 3, 'Mehrere Challenges brauchen eine Reihenfolge.', 'Drei oder mehr Ziele können Racecraft verwässern, wenn sie gleichzeitig verfolgt werden.', 'Sportliches Ergebnis über Belohnungen stellen.'],
  ['first_league', 'career.leagues_competed', 'eq', 1, 'Deine Career hat eine klare Liga-Basis.', 'Alle bisherigen Daten stammen aus einem konstanten Wettbewerbsumfeld.', 'Innerhalb derselben Liga Trends sauber vergleichen.'],
  ['two_leagues', 'career.leagues_competed', 'eq', 2, 'Zwei Ligen erweitern dein Vergleichsfeld.', 'Unterschiedliche Felder machen Ergebnisse vielseitiger, aber weniger direkt vergleichbar.', 'Liga-Kontext bei jeder Bewertung mitdenken.'],
  ['three_leagues', 'career.leagues_competed', 'gte', 3, 'Mehrere Ligen zeigen Anpassungsfähigkeit.', 'Deine Career umfasst mindestens drei unterschiedliche Wettbewerbsumfelder.', 'Stärken identifizieren, die ligaübergreifend funktionieren.'],
  ['first_season', 'career.seasons_competed', 'eq', 1, 'Die erste Saison baut deine Referenz.', 'Jedes neue Ergebnis schärft die Ausgangslage für spätere Vergleiche.', 'Saison vollständig und sauber abschließen.'],
  ['two_seasons', 'career.seasons_competed', 'eq', 2, 'Zwei Saisons machen Entwicklung sichtbar.', 'Jetzt lassen sich Fortschritt und wiederkehrende Schwächen besser trennen.', 'Saisonverläufe statt Einzelrennen vergleichen.'],
  ['three_seasons', 'career.seasons_competed', 'eq', 3, 'Drei Saisons bilden einen echten Trend.', 'Kurzfristige Form und langfristige Entwicklung lassen sich klarer unterscheiden.', 'Langzeittrend als Maßstab verwenden.'],
  ['five_seasons', 'career.seasons_competed', 'gte', 5, 'Mehrjährige Erfahrung bestätigt.', 'Mindestens fünf Saisons geben deinem Career-Profil hohe Aussagekraft.', 'Neue Ziele aus Langzeitmustern ableiten.'],
  ['pole_and_win', 'recent_result.grid_position', 'eq', 1, 'Pole in Sieg umgesetzt.', 'Das letzte Rennen verband Qualifying-Spitze und Rennausführung vollständig.', 'Den kompletten Ablauf als Referenz sichern.'],
  ['back_to_front', 'recent_result.position_delta', 'gte', 10, 'Große Aufholjagd bestätigt.', 'Mindestens zehn gewonnene Positionen zeigen starke Rennanpassung und Überholumsetzung.', 'Die Aufholjagd nach risikoarmen Erfolgsfaktoren zerlegen.'],
  ['front_row_podium', 'recent_result.grid_position', 'lte', 2, 'Startreihe eins in ein Podium verwandelt.', 'Die starke Ausgangslage wurde in ein Top-Drei-Ergebnis übersetzt.', 'Startphase und Reifenmanagement als Referenz nutzen.'],
  ['points_without_podium', 'career.podiums', 'eq', 0, 'Punktebasis ohne Podium aufgebaut.', 'Deine Career sammelt bereits Wert, während der erste große Durchbruch noch offen ist.', 'Den Abstand zur Top Drei konkret messen.'],
  ['fast_but_unreliable', 'career.fastest_laps', 'gte', 3, 'Tempo und Zuverlässigkeit laufen auseinander.', 'Mehrere schnellste Runden zeigen Pace, eine erhöhte Ausfallquote verhindert jedoch den vollen Ertrag.', 'Pace mit kontrollierter Rennausführung verbinden.'],
  ['consistent_no_win', 'career.classification_rate', 'gte', 0.9, 'Hohe Zuverlässigkeit wartet auf den Durchbruch.', 'Deine Klassifikationsbasis ist stark, der erste Sieg aber noch offen.', 'Gezielt erkennen, wo sichere Punkte zu Siegchancen werden.'],
  ['qualifying_gap', 'career.poles', 'eq', 0, 'Rennergebnisse entstehen ohne Pole-Basis.', 'Deine bisherigen Resultate wurden nicht durch Startplatz eins vorbereitet.', 'Qualifying als eigenständigen Entwicklungsbereich prüfen.'],
  ['racecraft_strength', 'recent_result.position_delta', 'gte', 3, 'Rennpace übertrifft die Startposition.', 'Mehrere gewonnene Plätze sprechen für gute Umsetzung über die Distanz.', 'Qualifying verbessern, ohne die Rennstärke zu verlieren.'],
  ['career_balance', 'career.classification_rate', 'gte', 0.85, 'Dein Profil verbindet Erfahrung und Stabilität.', 'Viele Starts, eine hohe Klassifikationsquote und wiederkehrende Punkte bilden ein belastbares Gesamtpaket.', 'Den größten verbleibenden Performance-Hebel auswählen.'],
];
contextRules.forEach(([key, field, operator, value, title, body, focus], index) => {
  const all = [condition(field, operator, value)];
  if (key === 'pole_and_win') all.push(condition('recent_result.finish_position', 'eq', 1));
  if (key === 'front_row_podium') all.push(condition('recent_result.finish_position', 'lte', 3));
  if (key === 'points_without_podium') all.push(condition('career.total_points', 'gt', 0));
  if (key === 'fast_but_unreliable') all.push(condition('career.dnf_rate', 'gte', 0.2));
  if (key === 'consistent_no_win') all.push(condition('career.wins', 'eq', 0));
  if (key === 'qualifying_gap') all.push(condition('career.starts', 'gte', 10));
  if (key === 'career_balance') all.push(condition('career.starts', 'gte', 25), condition('career.total_points', 'gte', 100));
  add('context', key, 740 + index, all, title, body, focus);
});

const signatureRules = [
  ['pole_win', [['recent_result.is_pole', 'eq', true], ['recent_result.finish_position', 'eq', 1]], 'Du hast Pole und Sieg zusammengebracht.', 'Du warst über eine Runde und über die Distanz der Maßstab.', 'Diesen kompletten Ablauf als Referenz speichern.'],
  ['pole_podium', [['recent_result.is_pole', 'eq', true], ['recent_result.finish_position', 'lte', 3]], 'Du hast die Pole auf dem Podium abgesichert.', 'Die Ausgangslage war maximal, das Ergebnis bleibt stark – aber da lag noch etwas zwischen euch.', 'Den Unterschied zwischen Siegchance und Podium isolieren.'],
  ['pole_top5', [['recent_result.is_pole', 'eq', true], ['recent_result.finish_position', 'lte', 5]], 'Deine Pole wurde ein Top-Fünf-Ergebnis.', 'Dein Qualifying war stärker als die Rennumsetzung. Das ist kein Drama, aber ein ziemlich klares Signal.', 'Rennpace und Strategie getrennt prüfen.'],
  ['pole_drop', [['recent_result.is_pole', 'eq', true], ['recent_result.finish_position', 'gt', 5]], 'Von Pole ist dir zu viel entglitten.', 'Du hattest die beste Ausgangslage und konntest sie nicht halten.', 'Den ersten entscheidenden Positionsverlust rekonstruieren.'],
  ['fastest_win', [['recent_result.is_fastest_lap', 'eq', true], ['recent_result.finish_position', 'eq', 1]], 'Du hattest Sieg und schnellste Runde.', 'Tempo und Ergebnis passen perfekt zusammen. Viel sauberer kannst du kaum ein Statement setzen.', 'Das Siegerpaket reproduzierbar machen.'],
  ['fastest_podium', [['recent_result.is_fastest_lap', 'eq', true], ['recent_result.finish_position', 'lte', 3]], 'Deine schnellste Runde kam mit einem Podium.', 'Du hattest nachweislich Spitzenpace und hast sie in ein starkes Ergebnis übersetzt.', 'Die verfügbare Pace über mehr Runden abrufen.'],
  ['fastest_top5', [['recent_result.is_fastest_lap', 'eq', true], ['recent_result.finish_position', 'lte', 5]], 'Deine Pace war schneller als dein Ergebnis.', 'Die schnellste Runde zeigt, dass mehr als P4 oder P5 möglich war.', 'Zeitverluste außerhalb der schnellsten Phase finden.'],
  ['fastest_outside10', [['recent_result.is_fastest_lap', 'eq', true], ['recent_result.finish_position', 'gt', 10]], 'Du warst schnell, aber nicht effizient.', 'Eine schnellste Runde außerhalb der Top Ten zeigt Potenzial ohne ausreichenden Rennertrag.', 'Pace in eine vollständige Rennausführung übersetzen.'],
  ['win_from_p6', [['recent_result.grid_position', 'gte', 6], ['recent_result.finish_position', 'eq', 1]], 'Du hast von außerhalb der Top Fünf gewonnen.', 'Das war keine verwaltete Führung, sondern echte Rennarbeit.', 'Die entscheidenden Überhol- und Strategiephasen sichern.'],
  ['podium_from_p11', [['recent_result.grid_position', 'gte', 11], ['recent_result.finish_position', 'lte', 3]], 'Du bist aus der zweiten Hälfte aufs Podium gefahren.', 'Deine Rennumsetzung hat die Startposition deutlich übertroffen.', 'Aufholstärke mit besserem Qualifying kombinieren.'],
  ['top10_from_p16', [['recent_result.grid_position', 'gte', 16], ['recent_result.finish_position', 'lte', 10]], 'Du hast dich aus dem Hinterfeld in die Top Ten gearbeitet.', 'Viele kleine richtige Entscheidungen haben dein Ergebnis getragen.', 'Die risikoarmen Positionsgewinne wiederholen.'],
  ['gain5_top5', [['recent_result.position_delta', 'gte', 5], ['recent_result.finish_position', 'lte', 5]], 'Du hast fünf Plätze gewonnen und vorne abgeschlossen.', 'Aufholjagd und Endposition passen zusammen – genau so wird Racecraft sichtbar.', 'Den starken Rennrhythmus konservieren.'],
  ['gain5_top10', [['recent_result.position_delta', 'gte', 5], ['recent_result.finish_position', 'lte', 10]], 'Du hast dich kontrolliert in die Top Ten gefahren.', 'Mindestens fünf gewonnene Plätze haben einen messbaren Ertrag gebracht.', 'Das Qualifying näher an die Rennpace bringen.'],
  ['loss5_outside10', [['recent_result.position_delta', 'lte', -5], ['recent_result.finish_position', 'gt', 10]], 'Du hast zu viele Positionen abgegeben.', 'Mindestens fünf verlorene Plätze und ein Ergebnis außerhalb der Top Ten verlangen eine klare Ursache.', 'Den teuersten Fehler zuerst abstellen.'],
  ['pole_p2', [['recent_result.grid_position', 'eq', 1], ['recent_result.finish_position', 'eq', 2]], 'Von Pole auf P2 – knapp, aber eindeutig.', 'Du warst nah dran. Jetzt zählt nicht mehr Grundtempo, sondern die eine Entscheidung mit dem größten Effekt.', 'Den Moment analysieren, in dem P1 verloren ging.'],
  ['pole_p3', [['recent_result.grid_position', 'eq', 1], ['recent_result.finish_position', 'eq', 3]], 'Von Pole auf P3 bleibt ein Podium mit Fragezeichen.', 'Dein Samstag war stärker als dein Rennsonntag.', 'Reifen, Start und Strategie in dieser Reihenfolge prüfen.'],
  ['win_grid2', [['recent_result.grid_position', 'eq', 2], ['recent_result.finish_position', 'eq', 1]], 'Du hast P2 in einen Sieg verwandelt.', 'Du brauchtest keine Pole, um das Rennen zu kontrollieren.', 'Den siegbringenden Positionswechsel festhalten.'],
  ['win_grid3plus', [['recent_result.grid_position', 'gte', 3], ['recent_result.finish_position', 'eq', 1]], 'Du hast von hinten zugeschlagen.', 'Der Sieg kam nicht aus der bequemsten Position – das macht deine Rennumsetzung besonders stark.', 'Die Geduld vor dem entscheidenden Angriff bewahren.'],
  ['p20_to_p10', [['recent_result.grid_position', 'eq', 20], ['recent_result.finish_position', 'lte', 10]], 'Du hast das halbe Feld hinter dir gelassen.', 'Vom letzten Startplatz in die Top Ten zu fahren, ist ein unmissverständliches Racecraft-Signal.', 'Qualifying verbessern und diese Rennstärke behalten.'],
  ['fastest_zero_points', [['recent_result.is_fastest_lap', 'eq', true], ['recent_result.awarded_points', 'eq', 0]], 'Du hattest die schnellste Runde, aber keine Punkte.', 'Dein Tempo war real, der Ertrag nicht. Vora sieht beides – und lässt dich damit nicht davonkommen.', 'Die schnelle Phase in ein punktfähiges Gesamtrennen einbetten.'],
];
signatureRules.forEach(([key, rules, title, body, focus], index) => add(
  'race_signature', key, 930 + index,
  rules.map(([field, operator, value]) => condition(field, operator, value)), title, body, focus,
));

Array.from({ length: 20 }, (_, index) => index).forEach((pointsPerStart, index) => add(
  'efficiency', `points_per_start_${pointsPerStart}`, 520 + (20 - index),
  [condition('career.points_per_start', 'between', [pointsPerStart, pointsPerStart + 0.99])],
  pointsPerStart === 0 ? 'Du lässt pro Start noch zu viele Punkte liegen.' : `Du holst im Schnitt rund ${pointsPerStart} Punkte pro Start.`,
  pointsPerStart >= 15
    ? 'Deine Punkteausbeute liegt im Spitzenbereich. Schütze diese Effizienz vor unnötigem Risiko.'
    : pointsPerStart >= 8
      ? 'Deine Ergebnisse liefern regelmäßig Wert, aber schwache Rennen drücken den Schnitt noch sichtbar.'
      : 'Schon eine zusätzliche saubere Punkteankunft kann deinen Schnitt deutlich verändern.',
  pointsPerStart >= 15 ? 'Effizienz auf unterschiedlichen Strecken bestätigen.' : pointsPerStart >= 8 ? 'Schwache Ergebnisse näher an deinen Normalbereich bringen.' : 'Klassifikationen und Punkte vor Einzeltempo stellen.',
));

const riskRules = [
  ['fast_safe', [['career.classification_rate', 'gte', 0.9], ['career.average_finish', 'lte', 5]], 'Du bist schnell und zuverlässig.', 'Dein Profil verbindet Top-Fünf-Schnitt mit hoher Zielankunftsquote.', 'Dieses Gleichgewicht schützen.'],
  ['fast_risky', [['career.average_finish', 'lte', 5], ['career.dnf_rate', 'gte', 0.2]], 'Du bist schnell, aber nicht immer verfügbar.', 'Dein Tempo reicht für starke Ergebnisse, doch Ausfälle nehmen dir zu oft den Ertrag.', 'Risiko reduzieren, ohne die Pace zu verstecken.'],
  ['safe_midfield', [['career.classification_rate', 'gte', 0.9], ['career.average_finish', 'between', [8, 14]]], 'Du kommst zuverlässig an – jetzt darfst du mehr verlangen.', 'Deine Basis ist stabil, deine Durchschnittsposition bietet aber noch Luft.', 'Kontrolliert mehr Positionsgewinn suchen.'],
  ['safe_backfield', [['career.classification_rate', 'gte', 0.9], ['career.average_finish', 'gt', 14]], 'Du bringst die Rennen nach Hause.', 'Zuverlässigkeit ist vorhanden. Jetzt geht es darum, aus Sicherheit echten Positionsgewinn zu machen.', 'Eine Rennphase offensiver gestalten.'],
  ['risky_no_reward', [['career.dnf_rate', 'gte', 0.25], ['career.average_finish', 'gt', 12]], 'Dein Risiko zahlt sich noch nicht aus.', 'Viele Ausfälle treffen auf einen schwachen Ergebnisschnitt.', 'Aggressivität nur dort einsetzen, wo sie messbaren Ertrag bringt.'],
  ['few_dnf_no_points', [['career.dnf_rate', 'lte', 0.1], ['career.points_per_start', 'lt', 2]], 'Du bist zuverlässig, aber zu selten belohnt.', 'Ankommen allein reicht dir nicht mehr. Deine saubere Basis muss in Punkte übergehen.', 'Punktefenster früher erkennen.'],
  ['wins_high_dnf', [['career.wins', 'gte', 3], ['career.dnf_rate', 'gte', 0.2]], 'Du kennst Siege und Ausfälle.', 'Dein Profil schwankt zwischen maximalem Ertrag und Nullrunde.', 'Siegpace häufiger ins Ziel bringen.'],
  ['podiums_clean', [['career.podiums', 'gte', 5], ['career.classification_rate', 'gte', 0.9]], 'Du verbindest Podien mit Verlässlichkeit.', 'Das ist keine Momentaufnahme, sondern ein belastbares Spitzenprofil.', 'Schwache Tage zu sicheren Punkten machen.'],
  ['poles_low_conversion', [['career.poles', 'gte', 3], ['career.win_podium_ratio', 'lt', 0.2]], 'Dein Qualifying flirtet mit der Spitze, dein Rennresultat noch nicht genug.', 'Mehrere Poles zeigen Tempo, doch die Umwandlung in Siege bleibt niedrig.', 'Start und erste Rennphase präziser absichern.'],
  ['pace_low_finish', [['career.fastest_laps', 'gte', 5], ['career.average_finish', 'gt', 10]], 'Deine Spitzenpace versteckt sich hinter dem Schnitt.', 'Mehrere schnellste Runden passen nicht zu einer durchschnittlichen Zielposition außerhalb der Top Ten.', 'Tempo über den gesamten Stint verteilen.'],
  ['clean_zero_dnf', [['career.starts', 'gte', 10], ['career.dnfs', 'eq', 0]], 'Zehn Starts oder mehr ohne DNF.', 'Du behandelst Rennabschlüsse nicht wie Zufall. Das ist eine starke Grundlage.', 'Zuverlässigkeit in mehr Angriffsspielraum verwandeln.'],
  ['dns_risk', [['career.dns', 'gte', 2], ['career.starts', 'gte', 5]], 'Nicht jedes Risiko liegt auf der Strecke.', 'Mehrere DNS kosten dich Chancen, bevor das Rennen überhaupt beginnt.', 'Vorbereitung und Verfügbarkeit verbindlich machen.'],
  ['dsq_risk', [['career.dsqs', 'gte', 2], ['career.starts', 'gte', 5]], 'Regelrisiko bremst deine Leistung.', 'Wiederholte Disqualifikationen sind vollständig vermeidbarer Verlust.', 'Regelkonformität vor jedem Start prüfen.'],
  ['aggressive_gain', [['recent_result.position_delta', 'gte', 6], ['career.dnf_rate', 'gte', 0.2]], 'Deine Angriffe funktionieren – aber nicht immer bis zum Ende.', 'Große Positionsgewinne treffen auf eine erhöhte Ausfallquote.', 'Erfolgreiche Aggressivität von unnötigem Risiko trennen.'],
  ['controlled_gain', [['recent_result.position_delta', 'gte', 3], ['career.classification_rate', 'gte', 0.9]], 'Du gewinnst Plätze, ohne das Ergebnis zu gefährden.', 'Racecraft und Zuverlässigkeit arbeiten in dieselbe Richtung.', 'Diese kontrollierte Aggressivität wiederholen.'],
  ['front_loss_safe', [['recent_result.grid_position', 'lte', 5], ['recent_result.position_delta', 'lte', -3]], 'Vorne gestartet, zu viel abgegeben.', 'Deine Ausgangslage war stark, doch das Rennen hat mindestens drei Positionen gekostet.', 'Verlustphase ohne hektische Gegenreaktion analysieren.'],
  ['back_gain_safe', [['recent_result.grid_position', 'gte', 12], ['recent_result.position_delta', 'gte', 5]], 'Du machst aus schlechten Startplätzen brauchbare Rennen.', 'Deine Aufholstärke rettet Ergebnisse, die im Qualifying verloren gehen.', 'Qualifying-Lücke schließen.'],
  ['high_points_low_win', [['career.points_per_start', 'gte', 10], ['career.win_rate', 'lt', 0.1]], 'Du sammelst stark, aber selten maximal.', 'Hohe Punkteausbeute zeigt Konstanz; Siege bleiben noch der nächste Schritt.', 'Den Unterschied zwischen sicherem Ergebnis und Siegchance erkennen.'],
  ['high_win_low_class', [['career.win_rate', 'gte', 0.2], ['career.classification_rate', 'lt', 0.8]], 'Dein Potenzial ist größer als deine Stabilität.', 'Du gewinnst oft genug, aber zu viele Rennen liefern gar keinen Ertrag.', 'Gewinnfähige Pace öfter klassifizieren.'],
  ['balanced_growth', [['career.points_per_start', 'gte', 5], ['career.classification_rate', 'gte', 0.85]], 'Dein Profil wächst ohne unnötige Ausschläge.', 'Punkte und Klassifikationen bilden eine kontrollierte Entwicklung.', 'Einen klaren Performance-Hebel nach dem anderen bearbeiten.'],
];
riskRules.forEach(([key, rules, title, body, focus], index) => add(
  'risk_balance', key, 780 + index,
  rules.map(([field, operator, value]) => condition(field, operator, value)), title, body, focus,
));

const milestoneRules = [
  ['starts_10', 'career.starts', 9, 'Dein zehnter Start ist nur ein Rennen entfernt.', 'Die erste zweistellige Career-Marke wartet auf dich.', 'Start zehn sauber klassifizieren.'],
  ['starts_25', 'career.starts', 24, 'Ein Start fehlt dir zu 25.', 'Deine Career nähert sich einem belastbaren Erfahrungsblock.', 'Die 25 mit einem kontrollierten Rennen vollmachen.'],
  ['starts_50', 'career.starts', 49, 'Start 50 wartet auf dich.', 'Du bist ein Rennen von einer echten Langzeitmarke entfernt.', 'Das Jubiläum nicht mit Zusatzrisiko überladen.'],
  ['starts_100', 'career.starts', 99, 'Dein hundertster Start steht vor der Tür.', 'Ein einziges Ergebnis trennt dich von einer außergewöhnlichen Career-Marke.', 'Start 100 bewusst und sauber abschließen.'],
  ['win_1', 'career.wins', 0, 'Dein erster Sieg ist noch offen.', 'Du brauchst keinen perfekten Mythos – nur ein Rennen, in dem die entscheidenden Dinge zusammenpassen.', 'Die realistischste Siegchance erkennen.'],
  ['wins_5', 'career.wins', 4, 'Ein Sieg fehlt dir zu fünf.', 'Die nächste Erfolgsmarke liegt direkt vor dir.', 'Nicht erzwingen, sondern die Chance sauber nutzen.'],
  ['wins_10', 'career.wins', 9, 'Der nächste Sieg macht deine Zahl zweistellig.', 'Neun Siege sind bestätigt. Einer fehlt noch für die nächste Kategorie.', 'Siegchance geduldig vorbereiten.'],
  ['podium_1', 'career.podiums', 0, 'Dein erstes Podium wartet.', 'Die Top Drei sind kein abstraktes Ziel – sie sind die nächste klare Schwelle.', 'Ein punktgenaues Podiumsrennen aufbauen.'],
  ['podiums_5', 'career.podiums', 4, 'Ein Podium fehlt dir zu fünf.', 'Du bist nah an einer belastbaren Top-Drei-Bilanz.', 'Podiumschance vor unnötigem Siegzwang schützen.'],
  ['podiums_10', 'career.podiums', 9, 'Ein Podium fehlt zur Zweistelligkeit.', 'Neun Top-Drei-Ergebnisse zeigen, dass der nächste Schritt realistisch ist.', 'Die Top-Drei-Routine wiederholen.'],
  ['podiums_25', 'career.podiums', 24, 'Podium Nummer 25 wartet auf dich.', 'Nur ein Ergebnis fehlt zu einer starken Langzeitmarke.', 'Das nächste Podium kontrolliert vollenden.'],
  ['pole_1', 'career.poles', 0, 'Deine erste Pole ist noch frei.', 'Eine perfekte Qualifying-Runde würde deinem Profil eine neue Facette geben.', 'Eine Runde kompromisslos sauber zusammensetzen.'],
  ['poles_5', 'career.poles', 4, 'Eine Pole fehlt dir zu fünf.', 'Deine Qualifying-Stärke steht kurz vor der nächsten Marke.', 'Qualifying-Prozess unverändert präzise halten.'],
  ['poles_10', 'career.poles', 9, 'Pole Nummer zehn ist in Reichweite.', 'Neun Poles zeigen, dass du die Geschwindigkeit dafür längst besitzt.', 'Nicht jagen – sauber abrufen.'],
  ['fastest_1', 'career.fastest_laps', 0, 'Deine erste schnellste Runde fehlt noch.', 'Ein klarer Pace-Nachweis wartet auf den richtigen Rennmoment.', 'Freie Strecke und Reifenfenster nutzen.'],
  ['fastest_5', 'career.fastest_laps', 4, 'Eine schnellste Runde fehlt dir zu fünf.', 'Deine Spitzenpace steht kurz vor der nächsten Marke.', 'Tempo nur dort abrufen, wo es das Rennen nicht gefährdet.'],
  ['fastest_10', 'career.fastest_laps', 9, 'Die zehnte schnellste Runde wartet.', 'Neun Pace-Signale sind bestätigt. Das nächste darf mit Ertrag kommen.', 'Schnelle Runde in ein starkes Gesamtergebnis einbetten.'],
  ['points_100', 'career.total_points', 99, 'Ein Punkt fehlt dir zu 100.', 'Die erste dreistellige Punktemarke ist praktisch erreicht.', 'Den fehlenden Punkt ohne Hektik sichern.'],
  ['points_500', 'career.total_points', 499, 'Ein Punkt fehlt dir zu 500.', 'Deine Career steht direkt vor einer großen Punktemarke.', 'Ergebnis nach Hause bringen.'],
  ['points_1000', 'career.total_points', 999, 'Ein Punkt fehlt dir zu 1.000.', 'Vierstellige Career-Punkte liegen nur noch einen Zähler entfernt.', 'Den Meilenstein mit Kontrolle abschließen.'],
];
milestoneRules.forEach(([key, field, value, title, body, focus], index) => add(
  'next_milestone', key, 880 + index, [condition(field, 'eq', value)], title, body, focus,
));

const profileRules = [
  ['qualifying_specialist', [['career.poles', 'gte', 5], ['career.win_rate', 'lt', 0.1]], 'Du bist aktuell ein Qualifying-Spezialist.', 'Deine Poles übertreffen deine Siegquote deutlich.', 'Ein-Runden-Pace in Rennkontrolle übersetzen.'],
  ['racecraft_specialist', [['career.poles', 'eq', 0], ['recent_result.position_delta', 'gte', 5]], 'Du arbeitest lieber im Rennen als am Samstag.', 'Keine Pole, aber starke Positionsgewinne: Deine Racecraft trägt dich.', 'Bessere Startplätze zur Rennstärke addieren.'],
  ['closer', [['career.win_podium_ratio', 'gte', 0.6], ['career.podiums', 'gte', 5]], 'Wenn du vorne bist, machst du oft Schluss.', 'Ein hoher Anteil deiner Podien wird zum Sieg.', 'Häufiger in deine Abschlusszone kommen.'],
  ['collector', [['career.points_per_start', 'gte', 8], ['career.win_rate', 'lt', 0.1]], 'Du bist ein effizienter Punktesammler.', 'Dein Schnitt ist stark, auch ohne viele Siege.', 'Aus Konstanz gezielte Siegchancen entwickeln.'],
  ['survivor', [['career.classification_rate', 'gte', 0.95], ['career.starts', 'gte', 20]], 'Du bist schwer aus dem Rennen zu bekommen.', 'Viele Starts und fast immer klassifiziert – das ist echte Rennhärte.', 'Stabilität offensiver nutzen.'],
  ['sprinter', [['career.fastest_laps', 'gte', 5], ['career.classification_rate', 'lt', 0.8]], 'Du hast Speed, aber noch keinen langen Atem.', 'Schnellste Runden zeigen dein Potenzial; Ausfälle begrenzen den Nutzen.', 'Tempo über die volle Distanz kontrollieren.'],
  ['front_runner', [['career.average_finish', 'lte', 4], ['career.podium_rate', 'gte', 0.5]], 'Du gehörst regelmäßig nach vorn.', 'Durchschnitt und Podiumsquote bestätigen ein Front-Runner-Profil.', 'Schwache Tage ohne großen Verlust überstehen.'],
  ['midfield_anchor', [['career.average_finish', 'between', [8, 12]], ['career.classification_rate', 'gte', 0.9]], 'Du bist der stabile Anker im Mittelfeld.', 'Deine Ergebnisse sind zuverlässig, der nächste Sprung braucht einen gezielten Hebel.', 'Eine Position im Durchschnitt gewinnen.'],
  ['comeback_driver', [['recent_result.grid_position', 'gte', 15], ['recent_result.finish_position', 'lte', 8]], 'Du kannst ein Rennen von hinten neu schreiben.', 'Dein letztes Ergebnis zeigt klare Comeback-Qualität.', 'Qualifying verbessern, ohne diese Geduld zu verlieren.'],
  ['pole_defender', [['career.poles', 'gte', 3], ['career.win_podium_ratio', 'gte', 0.5]], 'Du verteidigst starke Startplätze mit Ertrag.', 'Qualifying und Rennabschluss greifen bei dir ineinander.', 'Die komplette Wochenendstruktur bewahren.'],
  ['late_bloomer', [['career.starts', 'gte', 25], ['career.wins', 'eq', 0]], 'Deine Career wartet noch auf den großen Durchbruch.', 'Erfahrung ist reichlich da. Jetzt braucht es keinen Neustart, sondern Präzision.', 'Den realistischsten Weg zum ersten Sieg wählen.'],
  ['veteran_winner', [['career.starts', 'gte', 100], ['career.wins', 'gte', 10]], 'Du verbindest Erfahrung mit bestätigten Siegen.', 'Deine Daten zeigen, dass du über lange Zeit gewinnen kannst.', 'Erfahrung aktiv in Rennentscheidungen einsetzen.'],
  ['multi_league_adapter', [['career.leagues_competed', 'gte', 3], ['career.classification_rate', 'gte', 0.85]], 'Du passt dich an unterschiedliche Ligen an.', 'Mehrere Wettbewerbsfelder und stabile Ergebnisse zeigen Anpassungsfähigkeit.', 'Ligaübergreifende Erfolgsfaktoren festhalten.'],
  ['season_builder', [['career.seasons_competed', 'gte', 3], ['career.points_per_start', 'gte', 5]], 'Du baust Leistung über Saisons auf.', 'Deine Career zeigt langfristige Punktefähigkeit statt kurzer Ausschläge.', 'Saisonziele aus Langzeitdaten ableiten.'],
  ['clean_attacker', [['recent_result.position_delta', 'gte', 3], ['career.dnf_rate', 'lte', 0.1]], 'Du greifst an, ohne dich dabei zu verlieren.', 'Positionsgewinne und niedrige Ausfallquote sind eine starke Kombination.', 'Diese kontrollierte Schärfe behalten.'],
  ['high_variance', [['career.win_rate', 'gte', 0.15], ['career.classification_rate', 'lt', 0.75]], 'Bei dir liegen Sieg und Nullrunde zu nah beieinander.', 'Deine Spitzenresultate sind stark, deine Schwankung ebenfalls.', 'Den unteren Ergebnisbereich anheben.'],
  ['quiet_progress', [['career.win_rate', 'eq', 0], ['career.points_per_start', 'gte', 4]], 'Du entwickelst dich leiser, als deine Punkte vermuten lassen.', 'Ohne Sieg sammelst du bereits solide Ergebnisse.', 'Den nächsten Schritt nicht unterschätzen.'],
  ['maximum_attack', [['career.win_rate', 'gte', 0.3], ['career.dnf_rate', 'gte', 0.25]], 'Du fährst zwischen maximalem Angriff und maximalem Verlust.', 'Viele Siege treffen auf viele Ausfälle. Spektakulär, aber teuer.', 'Aggression nur in klaren Gewinnfenstern einsetzen.'],
  ['complete_package', [['career.win_rate', 'gte', 0.15], ['career.classification_rate', 'gte', 0.9]], 'Du bringst Tempo, Ergebnis und Zuverlässigkeit zusammen.', 'Dein Profil hat kaum eine offensichtliche Schwäche.', 'Feinheiten statt Grundprinzipien optimieren.'],
  ['developing_profile', [['career.starts', 'between', [5, 15]], ['career.points_per_start', 'lt', 4]], 'Dein Fahrerprofil ist noch formbar.', 'Genug Daten für erste Muster, aber noch nicht genug für endgültige Urteile.', 'Eine stabile Rennroutine festlegen.'],
];
profileRules.forEach(([key, rules, title, body, focus], index) => add(
  'driver_profile', key, 680 + index,
  rules.map(([field, operator, value]) => condition(field, operator, value)), title, body, focus,
));

const allowedFields = new Set([
  'active_challenges',
  'career.average_finish', 'career.best_finish', 'career.classification_rate', 'career.dnf_rate', 'career.dnfs', 'career.dns',
  'career.dsqs', 'career.fastest_laps', 'career.leagues_competed', 'career.points_per_start', 'career.podium_rate', 'career.podiums', 'career.poles',
  'career.seasons_competed', 'career.starts', 'career.total_points', 'career.win_podium_ratio', 'career.win_rate', 'career.wins',
  'progression.level', 'progression.xp_to_next_level',
  'recent_result.awarded_points', 'recent_result.classification_status', 'recent_result.finish_position', 'recent_result.grid_position',
  'recent_result.is_fastest_lap', 'recent_result.is_pole', 'recent_result.position_delta',
]);

if (catalog.length !== 300) throw new Error(`Expected 300 Vora insights, generated ${catalog.length}.`);
if (new Set(catalog.map((item) => item.id)).size !== catalog.length) throw new Error('Vora insight IDs must be unique.');
for (const item of catalog) {
  if (!item.title || !item.body || !item.focus || !item.when.all.length) throw new Error(`Incomplete insight: ${item.id}`);
  for (const rule of item.when.all) if (!allowedFields.has(rule.field)) throw new Error(`Unknown Vora field ${rule.field} in ${item.id}`);
}

const document = {
  schema_version: 1,
  catalog_version: '2026-08-30',
  language: 'de',
  selection: 'Alle Regeln werden nach Priorität absteigend geprüft; die erste vollständig erfüllte Regel gewinnt.',
  derived_fields: {
    'career.classification_rate': 'classified_finishes / starts',
    'career.dnf_rate': 'dnfs / starts',
    'career.points_per_start': 'total_points / starts',
    'career.podium_rate': 'podiums / starts',
    'career.win_rate': 'wins / starts',
    'career.win_podium_ratio': 'wins / podiums',
    'recent_result.position_delta': 'grid_position - finish_position',
  },
  insights: catalog.sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id)),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`Generated ${catalog.length} deterministic Vora insights at ${outputPath}`);
