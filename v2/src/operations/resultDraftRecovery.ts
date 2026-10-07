import type { Language } from '../i18n/messages';

const de = {
  discard: 'Entwurf verwerfen', confirm: 'Diesen Entwurf verwerfen?', cancel: 'Abbrechen',
  consequence: 'Nur dieser unveröffentlichte Entwurf wird aus der Freigabe entfernt. Rennergebnisse und Steward-Fälle bleiben erhalten. Danach kannst du die Bilder oben erneut auswählen und einen neuen Entwurf speichern.',
  done: 'Entwurf verworfen. Du kannst die Bilder erneut auswählen und importieren.',
  failed: 'Entwurf konnte nicht verworfen werden. Er bleibt erhalten. Bitte erneut versuchen.',
  published: 'Dieser Entwurf wurde bereits veröffentlicht und kann nicht mehr verworfen werden. Bitte die Seite neu laden.',
  discarded: 'Dieser Entwurf wurde bereits verworfen. Bitte die Seite neu laden und die Bilder erneut importieren.',
  times: 'Eine vorgemerkte Steward-Zeitkorrektur kann nicht berechnet werden: Es fehlen gültige Rennzeiten. Der Entwurf bleibt erhalten. Prüfe die Zeiten oder verwirf den Entwurf und importiere korrigierte Bilder erneut.',
  stale: 'Inzwischen wurde eine andere Ergebnisversion veröffentlicht. Bitte neu laden und die aktuellen Ergebnisse prüfen, bevor du neu importierst.',
  negative: 'Die Zeitgutschrift wäre größer als die Rennzeit. Bitte Rennzeit und Steward-Entscheidung prüfen. Es wurde nichts veröffentlicht.',
  denied: 'Diese Aktion erfordert die Ligaleitung beziehungsweise einen bestätigten Owner-Zugang.',
  publishFailed: 'Das Ergebnis wurde nicht als veröffentlicht bestätigt. Bitte erneut versuchen oder die Seite neu laden. Dein Entwurf bleibt erhalten.',
};
type Copy = typeof de;
const en: Copy = {
  discard:'Discard draft', confirm:'Discard this draft?', cancel:'Cancel', consequence:'Only this unpublished draft is removed from release. Official results and steward cases remain unchanged. You can then select images above and save a new draft.',
  done:'Draft discarded. You can select and import the images again.', failed:'The draft could not be discarded. It remains available. Please retry.', published:'This draft has already been published and cannot be discarded. Reload the page.', discarded:'This draft was already discarded. Reload and import the images again.',
  times:'A pending steward time correction needs valid race times. Your draft is preserved. Check the times or discard the draft and import corrected images again.', stale:'Another result version has been published. Reload and check the current results before importing again.', negative:'The time credit would exceed the race time. Check the time and steward decision. Nothing was published.', denied:'This action requires league management or verified owner access.', publishFailed:'Publication was not confirmed. Retry or reload the page. Your draft is preserved.',
};
const es: Copy = {
  discard:'Descartar borrador',confirm:'¿Descartar este borrador?',cancel:'Cancelar',consequence:'Solo se retira este borrador sin publicar. Los resultados oficiales y los casos de comisarios se conservan. Después puedes seleccionar imágenes arriba y guardar un nuevo borrador.',done:'Borrador descartado. Puedes seleccionar e importar las imágenes otra vez.',failed:'No se pudo descartar el borrador. Se conserva. Inténtalo de nuevo.',published:'Este borrador ya se publicó y no se puede descartar. Recarga la página.',discarded:'Este borrador ya se descartó. Recarga e importa las imágenes de nuevo.',times:'Una corrección de tiempo pendiente necesita tiempos de carrera válidos. Se conserva el borrador. Revisa los tiempos o descártalo e importa imágenes corregidas.',stale:'Se publicó otra versión. Recarga y revisa los resultados antes de importar de nuevo.',negative:'La bonificación supera el tiempo de carrera. Revisa el tiempo y la decisión. No se publicó nada.',denied:'Esta acción requiere dirección de liga o acceso de propietario verificado.',publishFailed:'No se confirmó la publicación. Reintenta o recarga. Se conserva el borrador.',
};
const fr: Copy = {
  discard:'Abandonner le brouillon',confirm:'Abandonner ce brouillon ?',cancel:'Annuler',consequence:'Seul ce brouillon non publié est retiré. Les résultats officiels et les dossiers des commissaires sont conservés. Vous pourrez sélectionner les images ci-dessus et enregistrer un nouveau brouillon.',done:'Brouillon abandonné. Vous pouvez sélectionner et importer les images à nouveau.',failed:'Impossible d’abandonner le brouillon. Il est conservé. Réessayez.',published:'Ce brouillon est déjà publié et ne peut pas être abandonné. Rechargez la page.',discarded:'Ce brouillon est déjà abandonné. Rechargez et importez les images à nouveau.',times:'Une correction de temps en attente exige des temps de course valides. Le brouillon est conservé. Vérifiez les temps ou abandonnez-le pour importer des images corrigées.',stale:'Une autre version a été publiée. Rechargez et vérifiez les résultats avant de réimporter.',negative:'Le crédit dépasserait le temps de course. Vérifiez le temps et la décision. Rien n’a été publié.',denied:'Cette action exige la direction de ligue ou un accès propriétaire vérifié.',publishFailed:'La publication n’a pas été confirmée. Réessayez ou rechargez. Le brouillon est conservé.',
};
export function resultRecoveryCopy(language: Language): Copy { return ({de,en,es,fr})[language]; }
export function resultRecoveryError(error: unknown, language: Language, action: 'publish' | 'discard'): string {
  const raw = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const copy = resultRecoveryCopy(language);
  if (/draft was discarded/i.test(raw)) return copy.discarded;
  if (/Only unpublished/i.test(raw)) return copy.published;
  if (/classified result with a valid race time|Complete the race times/i.test(raw)) return copy.times;
  if (/no longer current|revision base/i.test(raw)) return copy.stale;
  if (/make the race time negative/i.test(raw)) return copy.negative;
  if (/access denied|Authentication required|MFA/i.test(raw)) return copy.denied;
  return action === 'discard' ? copy.failed : copy.publishFailed;
}
