import type { LeagueSupabaseClient } from '../lib/supabase';
import { buildStandings, type StandingsData } from '../racing/standingsData';
import type { PublishedResult } from '../racing/resultsData';

export interface DraftChampionshipSnapshot {
  versionId: string; versionNumber: number; raceId: string; raceName: string;
  pendingCorrections: number; generatedAt: string; replacesPublished: boolean;
  data: StandingsData; draftRows: PublishedResult[];
}

export async function loadDraftChampionship(client: LeagueSupabaseClient, id: string, signal: AbortSignal) {
  const response = await client.rpc('get_result_draft_championship_preview', { p_result_version_id: id }).abortSignal(signal);
  signal.throwIfAborted();
  if (response.error) throw response.error;
  const snapshot = response.data as unknown as DraftChampionshipSnapshot;
  if (!snapshot || snapshot.versionId !== id || !snapshot.data?.season || !Array.isArray(snapshot.data.currentRoster)
    || !Array.isArray(snapshot.data.drivers) || !Array.isArray(snapshot.data.races) || !Array.isArray(snapshot.data.results)
    || !Array.isArray(snapshot.draftRows) || !snapshot.draftRows.length
    || !snapshot.data.races.some((race) => race.id === snapshot.raceId)
    || snapshot.draftRows.some((row) => row.race_id !== snapshot.raceId || row.result_version_id !== id)) {
    throw new Error('PREVIEW_INVALID_RESPONSE');
  }
  return snapshot;
}

export function buildDraftChampionship(snapshot: DraftChampionshipSnapshot) {
  const official = buildStandings(snapshot.data).driverStandings;
  // Replace this race, not append to its current official version. No input mutation.
  const projected: StandingsData = {
    ...snapshot.data,
    races: snapshot.data.races.map((race) => race.id === snapshot.raceId
      ? { ...race, status: 'completed', current_result_version_id: snapshot.versionId } : race),
    results: [...snapshot.data.results.filter((row) => row.race_id !== snapshot.raceId), ...snapshot.draftRows],
  };
  return buildStandings(projected).driverStandings.map((driver, index) => {
    const before = official.find((row) => row.driverId === driver.driverId);
    return { ...driver, position: index + 1, officialPoints: before?.points ?? 0, difference: driver.points - (before?.points ?? 0),
      gamertag: snapshot.data.drivers.find((row) => row.id === driver.driverId)?.gamertag };
  });
}

const de = {
  title: 'Vorläufige Fahrer-WM', draft: 'Gespeicherter Entwurf', refresh: 'Vorschau aktualisieren',
  note: 'Offizielle Saisonwertung inklusive dieses gespeicherten Entwurfs. Andere Entwürfe und ungespeicherte Änderungen sind nicht enthalten. Die offizielle WM und XP bleiben unverändert.',
  replacement: 'Dieser Entwurf ersetzt in der Vorschau das bisher veröffentlichte Ergebnis dieses Rennens.',
  steward: 'Vorgemerkte Zeitstrafen und Zeitgutschriften berücksichtigt:',
  loading: 'Vorläufige Tabelle wird berechnet …', empty: 'Nach dem Speichern eines Ergebnisentwurfs erscheint hier die vorläufige Fahrer-WM.',
  failed: 'Die Vorschau konnte nicht geladen werden. Bitte aktualisiere sie erneut.',
  stale: 'Dieser Entwurf ist nicht mehr aktuell. Lade die Seite neu und wähle einen aktuellen Entwurf.',
  times: 'Für die vorgemerkten Steward-Entscheidungen fehlen gültige Rennzeiten. Korrigiere den Entwurf, bevor du die Vorschau für die Startaufstellung verwendest.',
  negative: 'Eine vorgemerkte Zeitgutschrift würde eine negative Rennzeit ergeben. Bitte prüfe den Entwurf und den Steward-Fall.',
  denied: 'Die Vorschau ist nur für die Ligaleitung dieser Liga verfügbar.',
  position: 'Pos.', driver: 'Fahrer', points: 'Vorläufig', difference: 'Änderung', updated: 'Stand', noRows: 'In dieser Saison sind noch keine Fahrer zugeordnet.',
};
const translations: Record<string, typeof de> = {
  de,
  en: { title: 'Provisional Drivers’ Championship', draft: 'Saved draft', refresh: 'Refresh preview',
    note: 'Official season standings including this saved draft. Other drafts and unsaved changes are excluded. Official standings and XP remain unchanged.',
    replacement: 'This preview replaces the previously published result for this race.', steward: 'Pending time penalties and credits included:',
    loading: 'Calculating provisional standings …', empty: 'Save a result draft to see the provisional Drivers’ Championship here.',
    failed: 'The preview could not be loaded. Please refresh it.', stale: 'This draft is no longer current. Reload the page and select a current draft.',
    times: 'Pending steward decisions need valid race times. Correct the draft before using this preview for the grid.',
    negative: 'A pending time credit would produce a negative race time. Review the draft and steward case.', denied: 'Only this league’s management can view this preview.',
    position: 'Pos.', driver: 'Driver', points: 'Provisional', difference: 'Change', updated: 'Updated', noRows: 'No drivers are assigned to this season yet.' },
  fr: { title: 'Championnat pilotes provisoire', draft: 'Brouillon enregistré', refresh: 'Actualiser l’aperçu',
    note: 'Classement officiel de la saison incluant ce brouillon enregistré. Les autres brouillons et modifications non enregistrées sont exclus. Le classement officiel et les XP restent inchangés.',
    replacement: 'Cet aperçu remplace le résultat déjà publié pour cette course.', steward: 'Pénalités et crédits de temps en attente inclus :',
    loading: 'Calcul du classement provisoire…', empty: 'Enregistrez un brouillon de résultat pour afficher le classement provisoire ici.',
    failed: 'Impossible de charger l’aperçu. Veuillez l’actualiser.', stale: 'Ce brouillon n’est plus à jour. Rechargez la page et sélectionnez un brouillon actuel.',
    times: 'Les décisions en attente nécessitent des temps de course valides. Corrigez le brouillon avant d’utiliser cet aperçu pour la grille.',
    negative: 'Un crédit de temps en attente produirait un temps négatif. Vérifiez le brouillon et le dossier des commissaires.', denied: 'Cet aperçu est réservé à la direction de cette ligue.',
    position: 'Pos.', driver: 'Pilote', points: 'Provisoire', difference: 'Écart', updated: 'Mise à jour', noRows: 'Aucun pilote n’est encore inscrit à cette saison.' },
  es: { title: 'Campeonato de pilotos provisional', draft: 'Borrador guardado', refresh: 'Actualizar vista previa',
    note: 'Clasificación oficial de la temporada incluyendo este borrador guardado. No incluye otros borradores ni cambios sin guardar. La clasificación oficial y los XP no cambian.',
    replacement: 'Esta vista previa sustituye el resultado ya publicado de esta carrera.', steward: 'Penalizaciones y bonificaciones de tiempo pendientes incluidas:',
    loading: 'Calculando la clasificación provisional…', empty: 'Guarda un borrador de resultados para ver aquí la clasificación provisional.',
    failed: 'No se pudo cargar la vista previa. Actualízala de nuevo.', stale: 'Este borrador ya no está vigente. Recarga la página y selecciona uno actual.',
    times: 'Las decisiones pendientes necesitan tiempos de carrera válidos. Corrige el borrador antes de usar esta vista previa para la parrilla.',
    negative: 'Una bonificación pendiente daría un tiempo negativo. Revisa el borrador y el caso de comisarios.', denied: 'Solo la dirección de esta liga puede ver esta vista previa.',
    position: 'Pos.', driver: 'Piloto', points: 'Provisional', difference: 'Cambio', updated: 'Actualizado', noRows: 'Todavía no hay pilotos asignados a esta temporada.' },
};
export const draftChampionshipCopy = (language: string) => translations[language] ?? de;
export function draftChampionshipError(error: unknown, language: string) {
  const copy = draftChampionshipCopy(language);
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  return message.includes('PREVIEW_DRAFT_STALE') ? copy.stale : message.includes('PREVIEW_STEWARD_TIMES_REQUIRED') ? copy.times
    : message.includes('PREVIEW_NEGATIVE_TIME') ? copy.negative : message.includes('PREVIEW_ACCESS_DENIED') ? copy.denied : copy.failed;
}
