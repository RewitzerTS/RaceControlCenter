import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export const SUPPORTED_LANGUAGES = ['de', 'en', 'es', 'fr'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const messages = {
  de: {
    product: 'RaceVora',
    staging: 'V2 Staging',
    overview: 'Übersicht',
    foundation: 'Globale Fahreridentität',
    environment: 'Umgebung',
    tenant: 'Liga-Kontext',
    session: 'Sitzung',
    authorization: 'Berechtigung',
    driverIdentity: 'Driver Identity',
    ready: 'bereit',
    pending: 'wird geprüft',
    signedOut: 'nicht angemeldet',
    noRole: 'nicht bestätigt',
    notConfirmed: 'nicht sicher bestätigt',
    noIdentity: 'noch nicht eingerichtet',
    identityActive: 'aktiv',
    identitySuspended: 'gesperrt',
    linkedRecords: 'verknüpfte Fahrer',
    protectedCopy: 'Diese V2-Instanz ist technisch von Production getrennt.',
    next: 'Nächster Baustein',
    nextCopy: 'Einheitliches Rollenmodell für Fahrer, Stewards, Liga-Admins und Platform Owner.',
    language: 'Sprache',
  },
  en: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Overview', foundation: 'Global driver identity',
    environment: 'Environment', tenant: 'League context', session: 'Session', authorization: 'Authorization',
    ready: 'ready', pending: 'checking', signedOut: 'signed out', noRole: 'not confirmed',
    driverIdentity: 'Driver identity', notConfirmed: 'not safely confirmed', noIdentity: 'not set up yet',
    identityActive: 'active', identitySuspended: 'suspended', linkedRecords: 'linked drivers',
    protectedCopy: 'This V2 instance is technically isolated from Production.', next: 'Next building block',
    nextCopy: 'A unified role model for drivers, stewards, league admins, and the platform owner.', language: 'Language',
  },
  es: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Resumen', foundation: 'Identidad global del piloto',
    environment: 'Entorno', tenant: 'Contexto de liga', session: 'Sesión', authorization: 'Autorización',
    ready: 'listo', pending: 'comprobando', signedOut: 'sin sesión', noRole: 'sin confirmar',
    driverIdentity: 'Identidad del piloto', notConfirmed: 'sin confirmación segura', noIdentity: 'aún no configurada',
    identityActive: 'activa', identitySuspended: 'suspendida', linkedRecords: 'pilotos vinculados',
    protectedCopy: 'Esta instancia V2 está técnicamente aislada de Producción.', next: 'Siguiente bloque',
    nextCopy: 'Un modelo de roles unificado para pilotos, comisarios, administradores y el propietario.', language: 'Idioma',
  },
  fr: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Vue d’ensemble', foundation: 'Identité globale du pilote',
    environment: 'Environnement', tenant: 'Contexte de ligue', session: 'Session', authorization: 'Autorisation',
    ready: 'prêt', pending: 'vérification', signedOut: 'déconnecté', noRole: 'non confirmé',
    driverIdentity: 'Identité du pilote', notConfirmed: 'non confirmée de façon sûre', noIdentity: 'pas encore configurée',
    identityActive: 'active', identitySuspended: 'suspendue', linkedRecords: 'pilotes liés',
    protectedCopy: 'Cette instance V2 est techniquement isolée de la Production.', next: 'Prochain socle',
    nextCopy: 'Un modèle de rôles unifié pour pilotes, commissaires, admins de ligue et propriétaire.', language: 'Langue',
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
