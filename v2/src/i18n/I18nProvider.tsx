import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export const SUPPORTED_LANGUAGES = ['de', 'en', 'es', 'fr'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const messages = {
  de: {
    product: 'RaceVora',
    staging: 'V2 Staging',
    overview: 'Übersicht',
    foundation: 'Sicheres Rollenmodell',
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
    protectedCopy: 'Diese V2-Instanz ist technisch von Production getrennt.',
    next: 'Nächster Baustein',
    nextCopy: 'Versionierte Rennergebnisse mit eindeutigem aktuellen Stand und sicherer Korrekturhistorie.',
    language: 'Sprache',
  },
  en: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Overview', foundation: 'Secure role model',
    environment: 'Environment', tenant: 'League context', session: 'Session', authorization: 'Authorization',
    ready: 'ready', pending: 'checking', signedOut: 'signed out', noRole: 'not confirmed',
    driverIdentity: 'Driver identity', notConfirmed: 'not safely confirmed', noIdentity: 'not set up yet',
    driverRole: 'Driver', stewardRole: 'Steward', leagueAdminRole: 'League administration', platformOwnerRole: 'Platform owner',
    identityActive: 'active', identitySuspended: 'suspended', linkedRecords: 'linked drivers',
    protectedCopy: 'This V2 instance is technically isolated from Production.', next: 'Next building block',
    nextCopy: 'Versioned race results with one authoritative current state and a safe correction history.', language: 'Language',
  },
  es: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Resumen', foundation: 'Modelo de roles seguro',
    environment: 'Entorno', tenant: 'Contexto de liga', session: 'Sesión', authorization: 'Autorización',
    ready: 'listo', pending: 'comprobando', signedOut: 'sin sesión', noRole: 'sin confirmar',
    driverIdentity: 'Identidad del piloto', notConfirmed: 'sin confirmación segura', noIdentity: 'aún no configurada',
    driverRole: 'Piloto', stewardRole: 'Comisario', leagueAdminRole: 'Administración de liga', platformOwnerRole: 'Propietario de plataforma',
    identityActive: 'activa', identitySuspended: 'suspendida', linkedRecords: 'pilotos vinculados',
    protectedCopy: 'Esta instancia V2 está técnicamente aislada de Producción.', next: 'Siguiente bloque',
    nextCopy: 'Resultados versionados con un estado actual único y un historial seguro de correcciones.', language: 'Idioma',
  },
  fr: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Vue d’ensemble', foundation: 'Modèle de rôles sécurisé',
    environment: 'Environnement', tenant: 'Contexte de ligue', session: 'Session', authorization: 'Autorisation',
    ready: 'prêt', pending: 'vérification', signedOut: 'déconnecté', noRole: 'non confirmé',
    driverIdentity: 'Identité du pilote', notConfirmed: 'non confirmée de façon sûre', noIdentity: 'pas encore configurée',
    driverRole: 'Pilote', stewardRole: 'Commissaire', leagueAdminRole: 'Administration de ligue', platformOwnerRole: 'Propriétaire de la plateforme',
    identityActive: 'active', identitySuspended: 'suspendue', linkedRecords: 'pilotes liés',
    protectedCopy: 'Cette instance V2 est techniquement isolée de la Production.', next: 'Prochain socle',
    nextCopy: 'Des résultats versionnés avec un état actuel unique et un historique sûr des corrections.', language: 'Langue',
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
