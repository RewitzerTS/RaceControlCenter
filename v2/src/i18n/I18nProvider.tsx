import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export const SUPPORTED_LANGUAGES = ['de', 'en', 'es', 'fr'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const messages = {
  de: {
    product: 'RaceVora',
    staging: 'V2 Staging',
    overview: 'Übersicht',
    foundation: 'Versionierte Rennergebnisse',
    environment: 'Umgebung',
    tenant: 'Liga-Kontext',
    session: 'Sitzung',
    authorization: 'Berechtigung',
    driverIdentity: 'Driver Identity',
    ready: 'bereit',
    pending: 'wird geprüft',
    signedOut: 'nicht angemeldet',
    noRole: 'nicht bestätigt',
    driverRole: 'Fahrer',
    stewardRole: 'Steward',
    leagueAdminRole: 'Ligaleitung',
    platformOwnerRole: 'Platform Owner',
    notConfirmed: 'nicht sicher bestätigt',
    noIdentity: 'noch nicht eingerichtet',
    identityActive: 'aktiv',
    identitySuspended: 'gesperrt',
    linkedRecords: 'verknüpfte Fahrer',
    resultHistory: 'Ergebnis-Historie',
    explicitPointer: 'expliziter aktueller Stand',
    protectedCopy: 'Diese V2-Instanz ist technisch von Production getrennt.',
    next: 'Nächster Baustein',
    nextCopy: 'Zuverlässige Domain Events für Veröffentlichung, Korrektur und Void-Verarbeitung.',
    language: 'Sprache',
  },
  en: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Overview', foundation: 'Versioned race results',
    environment: 'Environment', tenant: 'League context', session: 'Session', authorization: 'Authorization',
    ready: 'ready', pending: 'checking', signedOut: 'signed out', noRole: 'not confirmed',
    driverIdentity: 'Driver identity', notConfirmed: 'not safely confirmed', noIdentity: 'not set up yet',
    driverRole: 'Driver', stewardRole: 'Steward', leagueAdminRole: 'League administration', platformOwnerRole: 'Platform owner',
    identityActive: 'active', identitySuspended: 'suspended', linkedRecords: 'linked drivers',
    resultHistory: 'Result history', explicitPointer: 'explicit current state',
    protectedCopy: 'This V2 instance is technically isolated from Production.', next: 'Next building block',
    nextCopy: 'Reliable domain events for publication, revision, and void processing.', language: 'Language',
  },
  es: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Resumen', foundation: 'Resultados de carrera versionados',
    environment: 'Entorno', tenant: 'Contexto de liga', session: 'Sesión', authorization: 'Autorización',
    ready: 'listo', pending: 'comprobando', signedOut: 'sin sesión', noRole: 'sin confirmar',
    driverIdentity: 'Identidad del piloto', notConfirmed: 'sin confirmación segura', noIdentity: 'aún no configurada',
    driverRole: 'Piloto', stewardRole: 'Comisario', leagueAdminRole: 'Administración de liga', platformOwnerRole: 'Propietario de plataforma',
    identityActive: 'activa', identitySuspended: 'suspendida', linkedRecords: 'pilotos vinculados',
    resultHistory: 'Historial de resultados', explicitPointer: 'estado actual explícito',
    protectedCopy: 'Esta instancia V2 está técnicamente aislada de Producción.', next: 'Siguiente bloque',
    nextCopy: 'Eventos de dominio fiables para publicación, revisión y anulación.', language: 'Idioma',
  },
  fr: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Vue d’ensemble', foundation: 'Résultats de course versionnés',
    environment: 'Environnement', tenant: 'Contexte de ligue', session: 'Session', authorization: 'Autorisation',
    ready: 'prêt', pending: 'vérification', signedOut: 'déconnecté', noRole: 'non confirmé',
    driverIdentity: 'Identité du pilote', notConfirmed: 'non confirmée de façon sûre', noIdentity: 'pas encore configurée',
    driverRole: 'Pilote', stewardRole: 'Commissaire', leagueAdminRole: 'Administration de ligue', platformOwnerRole: 'Propriétaire de la plateforme',
    identityActive: 'active', identitySuspended: 'suspendue', linkedRecords: 'pilotes liés',
    resultHistory: 'Historique des résultats', explicitPointer: 'état actuel explicite',
    protectedCopy: 'Cette instance V2 est techniquement isolée de la Production.', next: 'Prochain socle',
    nextCopy: 'Des événements métier fiables pour la publication, la révision et l’annulation.', language: 'Langue',
  },
} as const;

type MessageKey = keyof typeof messages.de;

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function browserLanguage(): Language {
  const requested = navigator.language.slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(requested as Language) ? requested as Language : 'de';
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<Language>(browserLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    t: (key) => messages[language][key],
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider.');
  return context;
}
