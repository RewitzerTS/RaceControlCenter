import type { LeagueSupabaseClient } from '../lib/supabase';

export type PublicNameMode = 'name' | 'gamertag';
export type NameSettings = { name: string; gamertag: string | null; public_name_mode: PublicNameMode | null; needs_confirmation: boolean; revision: string };
export function nameSettings(value: unknown): NameSettings | null {
  if (value === null) return null;
  const data = value as NameSettings;
  if (!data || typeof data.name !== 'string' || typeof data.revision !== 'string'
    || typeof data.needs_confirmation !== 'boolean' || ![null, 'name', 'gamertag'].includes(data.public_name_mode)
    || (data.gamertag !== null && typeof data.gamertag !== 'string')) throw new Error('NAME_SETTINGS_RESPONSE');
  return data;
}
export async function loadNameSettings(client: LeagueSupabaseClient) {
  const { data, error } = await client.rpc('get_my_name_settings');
  if (error) throw error;
  return nameSettings(data);
}
export async function saveNameSettings(client: LeagueSupabaseClient, name: string, mode: PublicNameMode, revision: string) {
  const clean = name.trim();
  if (Array.from(clean).length < 2 || Array.from(clean).length > 60 || /[<>\u0000-\u001f\u007f]/.test(clean)
    || !['name', 'gamertag'].includes(mode)) throw new Error('NAME_SETTINGS_INVALID');
  const { data, error } = await client.rpc('save_my_name_settings', { p_name: clean, p_public_name_mode: mode, p_revision: revision });
  if (error) throw error;
  const saved = nameSettings(data);
  if (!saved || saved.name !== clean || saved.public_name_mode !== mode) throw new Error('NAME_SETTINGS_RESPONSE');
  return saved;
}
// Preserve IDs and original matching labels. Only the presentation name changes.
export function withPublicName<T extends { display_name: string; public_name?: string | null }>(driver: T): T {
  return driver.public_name?.trim() ? { ...driver, display_name: driver.public_name } : driver;
}

export const nameCopy = {
  de: { title: 'Name und öffentliche Anzeige', name: 'Name / Vorname', hint: 'Dein echter Name oder Vorname. Du entscheidest, ob er öffentlich angezeigt wird.', choice: 'Öffentlich anzeigen als', tag: 'Haupt-Gamertag', choose: 'Bitte auswählen', preview: 'Öffentlich sichtbar', scope: 'Gilt für deine verknüpften Fahrerprofile, Tabellen und neue Grafiken. Bereits gespeicherte Bilder und Texte ändern sich nicht.', legacy: 'Bitte prüfe den übernommenen Namen und wähle deine öffentliche Anzeige. Bis zum Speichern bleibt die bisherige Darstellung erhalten.', save: 'Name und Anzeige speichern', saved: 'Name und öffentliche Anzeige gespeichert.', error: 'Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten. Bitte erneut versuchen.', loadError: 'Deine Namenseinstellungen konnten nicht geladen werden.', retry: 'Erneut laden', stale: 'Name oder Gamertag wurden inzwischen geändert. Lade den aktuellen Stand neu.', invalid: 'Gib 2–60 Zeichen ohne < oder > ein und wähle deine öffentliche Anzeige.', tagRequired: 'Trage zuerst einen Haupt-Gamertag ein.', setup: 'Fahrerprofil einrichten' },
  en: { title: 'Name and public appearance', name: 'Name / first name', hint: 'Your real name or first name. You decide whether it is displayed publicly.', choice: 'Display publicly as', tag: 'Main gamertag', choose: 'Please choose', preview: 'Publicly visible', scope: 'Applies to linked driver profiles, standings and new graphics. Existing images and written text do not change.', legacy: 'Check the existing name and choose your public appearance. Nothing changes until you save.', save: 'Save name and appearance', saved: 'Name and public appearance saved.', error: 'Could not save. Your input is preserved. Please try again.', loadError: 'Your name settings could not be loaded.', retry: 'Reload', stale: 'Your name or gamertag has changed. Reload the current settings.', invalid: 'Enter 2–60 characters without < or > and choose your public appearance.', tagRequired: 'Add a main gamertag first.', setup: 'Set up driver profile' },
  es: { title: 'Nombre e identidad pública', name: 'Nombre / nombre de pila', hint: 'Tu nombre real o de pila. Tú decides si se muestra públicamente.', choice: 'Mostrar públicamente como', tag: 'Gamertag principal', choose: 'Selecciona una opción', preview: 'Visible públicamente', scope: 'Se aplica a perfiles vinculados, clasificaciones y gráficos nuevos. Las imágenes y los textos existentes no cambian.', legacy: 'Revisa el nombre existente y elige cómo aparecer. Nada cambia hasta guardar.', save: 'Guardar nombre e identidad', saved: 'Nombre e identidad pública guardados.', error: 'No se pudo guardar. Se conservan tus datos. Inténtalo de nuevo.', loadError: 'No se pudieron cargar tus datos de nombre.', retry: 'Volver a cargar', stale: 'Tu nombre o gamertag ha cambiado. Vuelve a cargar los datos actuales.', invalid: 'Introduce entre 2 y 60 caracteres sin < ni > y elige cómo aparecer.', tagRequired: 'Añade primero un gamertag principal.', setup: 'Configurar perfil de piloto' },
  fr: { title: 'Nom et identité publique', name: 'Nom / prénom', hint: 'Votre vrai nom ou prénom. Vous décidez s’il est affiché publiquement.', choice: 'Afficher publiquement', tag: 'Gamertag principal', choose: 'Choisissez une option', preview: 'Visible publiquement', scope: 'S’applique aux profils liés, classements et nouveaux visuels. Les images et textes existants ne changent pas.', legacy: 'Vérifiez le nom existant et choisissez votre identité publique. Rien ne change avant l’enregistrement.', save: 'Enregistrer le nom et l’identité', saved: 'Nom et identité publique enregistrés.', error: 'Enregistrement impossible. Votre saisie est conservée. Réessayez.', loadError: 'Impossible de charger les paramètres de votre nom.', retry: 'Recharger', stale: 'Votre nom ou gamertag a changé. Rechargez les paramètres actuels.', invalid: 'Saisissez 2 à 60 caractères sans < ni > et choisissez votre identité publique.', tagRequired: 'Ajoutez d’abord un gamertag principal.', setup: 'Configurer le profil pilote' },
};
