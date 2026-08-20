import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export const SUPPORTED_LANGUAGES = ['de', 'en', 'es', 'fr'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const messages = {
  de: {
    product: 'RaceVora',
    staging: 'V2 Staging',
    overview: 'Übersicht',
    foundation: 'Technische Grundlage',
    environment: 'Umgebung',
    tenant: 'Liga-Kontext',
    session: 'Sitzung',
    authorization: 'Berechtigung',
    ready: 'bereit',
    pending: 'wird geprüft',
    signedOut: 'nicht angemeldet',
    noRole: 'nicht bestätigt',
    protectedCopy: 'Diese V2-Instanz ist technisch von Production getrennt.',
    next: 'Nächster Baustein',
    nextCopy: 'Staging-Schema und Auth-Redirects nach Freigabe der externen Ressourcen.',
    language: 'Sprache',
  },
  en: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Overview', foundation: 'Technical foundation',
    environment: 'Environment', tenant: 'League context', session: 'Session', authorization: 'Authorization',
    ready: 'ready', pending: 'checking', signedOut: 'signed out', noRole: 'not confirmed',
    protectedCopy: 'This V2 instance is technically isolated from Production.', next: 'Next building block',
    nextCopy: 'Staging schema and auth redirects after external resources are approved.', language: 'Language',
  },
  es: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Resumen', foundation: 'Base técnica',
    environment: 'Entorno', tenant: 'Contexto de liga', session: 'Sesión', authorization: 'Autorización',
    ready: 'listo', pending: 'comprobando', signedOut: 'sin sesión', noRole: 'sin confirmar',
    protectedCopy: 'Esta instancia V2 está técnicamente aislada de Producción.', next: 'Siguiente bloque',
    nextCopy: 'Esquema de staging y redirecciones de acceso tras aprobar los recursos externos.', language: 'Idioma',
  },
  fr: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Vue d’ensemble', foundation: 'Socle technique',
    environment: 'Environnement', tenant: 'Contexte de ligue', session: 'Session', authorization: 'Autorisation',
    ready: 'prêt', pending: 'vérification', signedOut: 'déconnecté', noRole: 'non confirmé',
    protectedCopy: 'Cette instance V2 est techniquement isolée de la Production.', next: 'Prochain socle',
    nextCopy: 'Schéma de staging et redirections d’authentification après validation des ressources externes.', language: 'Langue',
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
