import type { Language } from '../i18n/messages';

const messages = {
  de: ['Entwurf in diesem Tab gesichert · noch nicht übernommen.', 'Dein ungespeicherter Entwurf wurde wiederhergestellt.', 'Der Entwurf kann in diesem Browser nicht gesichert werden. Bitte vor dem Verlassen speichern.', 'Bilddateien bei Bedarf erneut auswählen; geprüfte Zeilen bleiben erhalten.'],
  en: ['Draft saved in this tab · not submitted yet.', 'Your unsaved draft has been restored.', 'This browser cannot keep your draft. Please save before leaving.', 'Select image files again if needed; reviewed rows are preserved.'],
  es: ['Borrador guardado en esta pestaña · aún no enviado.', 'Se ha recuperado tu borrador sin enviar.', 'Este navegador no puede conservar el borrador. Guarda antes de salir.', 'Vuelve a seleccionar las imágenes si es necesario; las filas revisadas se conservan.'],
  fr: ['Brouillon conservé dans cet onglet · pas encore envoyé.', 'Votre brouillon non envoyé a été restauré.', 'Ce navigateur ne peut pas conserver le brouillon. Enregistrez avant de quitter.', 'Sélectionnez à nouveau les images si nécessaire ; les lignes vérifiées sont conservées.'],
};

export function DraftRecoveryNotice({ draft, language = 'de', images = false }: {
  draft: { dirty: boolean; restored: boolean; unavailable: boolean };
  language?: Language;
  images?: boolean;
}) {
  if (!draft.dirty && !draft.restored) return null;
  const text = messages[language];
  return <p className="draft-recovery-notice" role="status">
    {text[draft.unavailable ? 2 : draft.restored ? 1 : 0]}
    {draft.restored && images && <> {text[3]}</>}
  </p>;
}
