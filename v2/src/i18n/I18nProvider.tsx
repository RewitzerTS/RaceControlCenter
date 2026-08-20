import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export const SUPPORTED_LANGUAGES = ['de', 'en', 'es', 'fr'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const messages = {
  de: {
    product: 'RaceVora',
    staging: 'V2 Staging',
    overview: 'Übersicht',
    foundation: 'XP, Level und Rank',
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
    eventProcessing: 'Event-Verarbeitung',
    independentProcessors: '7 unabhängige Processor',
    careerSource: 'Career-Quelle',
    currentOfficialResults: 'aktuelle offizielle Ergebnisse',
    careerScope: 'Career-Umfang',
    crossLeagueIdentity: 'ligaübergreifende Identität',
    xpSource: 'XP-Quelle',
    appendOnlyLedger: 'unveränderliches Ledger',
    levelRange: 'Level-Bereich',
    oneToHundred: '1 bis 100',
    highestRank: 'Höchster Rank',
    immortal: 'Immortal',
    protectedCopy: 'Diese V2-Instanz ist technisch von Production getrennt.',
    next: 'Nächster Baustein',
    nextCopy: 'Deterministische Achievements mit Unlock und Revoke bei Ergebnisänderungen.',
    language: 'Sprache',
  },
  en: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Overview', foundation: 'XP, Level, and Rank',
    environment: 'Environment', tenant: 'League context', session: 'Session', authorization: 'Authorization',
    ready: 'ready', pending: 'checking', signedOut: 'signed out', noRole: 'not confirmed',
    driverIdentity: 'Driver identity', notConfirmed: 'not safely confirmed', noIdentity: 'not set up yet',
    driverRole: 'Driver', stewardRole: 'Steward', leagueAdminRole: 'League administration', platformOwnerRole: 'Platform owner',
    identityActive: 'active', identitySuspended: 'suspended', linkedRecords: 'linked drivers',
    resultHistory: 'Result history', explicitPointer: 'explicit current state',
    eventProcessing: 'Event processing', independentProcessors: '7 independent processors',
    careerSource: 'Career source', currentOfficialResults: 'current official results',
    careerScope: 'Career scope', crossLeagueIdentity: 'cross-league identity',
    xpSource: 'XP source', appendOnlyLedger: 'immutable ledger',
    levelRange: 'Level range', oneToHundred: '1 to 100',
    highestRank: 'Highest rank', immortal: 'Immortal',
    protectedCopy: 'This V2 instance is technically isolated from Production.', next: 'Next building block',
    nextCopy: 'Deterministic achievements with unlock and revoke after result changes.', language: 'Language',
  },
  es: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Resumen', foundation: 'XP, nivel y rango',
    environment: 'Entorno', tenant: 'Contexto de liga', session: 'Sesión', authorization: 'Autorización',
    ready: 'listo', pending: 'comprobando', signedOut: 'sin sesión', noRole: 'sin confirmar',
    driverIdentity: 'Identidad del piloto', notConfirmed: 'sin confirmación segura', noIdentity: 'aún no configurada',
    driverRole: 'Piloto', stewardRole: 'Comisario', leagueAdminRole: 'Administración de liga', platformOwnerRole: 'Propietario de plataforma',
    identityActive: 'activa', identitySuspended: 'suspendida', linkedRecords: 'pilotos vinculados',
    resultHistory: 'Historial de resultados', explicitPointer: 'estado actual explícito',
    eventProcessing: 'Procesamiento de eventos', independentProcessors: '7 procesadores independientes',
    careerSource: 'Fuente de carrera', currentOfficialResults: 'resultados oficiales actuales',
    careerScope: 'Alcance de carrera', crossLeagueIdentity: 'identidad entre ligas',
    xpSource: 'Fuente de XP', appendOnlyLedger: 'libro mayor inmutable',
    levelRange: 'Rango de nivel', oneToHundred: '1 a 100',
    highestRank: 'Rango máximo', immortal: 'Immortal',
    protectedCopy: 'Esta instancia V2 está técnicamente aislada de Producción.', next: 'Siguiente bloque',
    nextCopy: 'Logros deterministas con desbloqueo y revocación tras cambios de resultados.', language: 'Idioma',
  },
  fr: {
    product: 'RaceVora', staging: 'V2 Staging', overview: 'Vue d’ensemble', foundation: 'XP, niveau et rang',
    environment: 'Environnement', tenant: 'Contexte de ligue', session: 'Session', authorization: 'Autorisation',
    ready: 'prêt', pending: 'vérification', signedOut: 'déconnecté', noRole: 'non confirmé',
    driverIdentity: 'Identité du pilote', notConfirmed: 'non confirmée de façon sûre', noIdentity: 'pas encore configurée',
    driverRole: 'Pilote', stewardRole: 'Commissaire', leagueAdminRole: 'Administration de ligue', platformOwnerRole: 'Propriétaire de la plateforme',
    identityActive: 'active', identitySuspended: 'suspendue', linkedRecords: 'pilotes liés',
    resultHistory: 'Historique des résultats', explicitPointer: 'état actuel explicite',
    eventProcessing: 'Traitement des événements', independentProcessors: '7 processeurs indépendants',
    careerSource: 'Source de carrière', currentOfficialResults: 'résultats officiels actuels',
    careerScope: 'Portée de carrière', crossLeagueIdentity: 'identité inter-ligues',
    xpSource: 'Source XP', appendOnlyLedger: 'registre immuable',
    levelRange: 'Plage de niveau', oneToHundred: '1 à 100',
    highestRank: 'Rang maximal', immortal: 'Immortal',
    protectedCopy: 'Cette instance V2 est techniquement isolée de la Production.', next: 'Prochain socle',
    nextCopy: 'Succès déterministes avec déblocage et révocation après modification des résultats.', language: 'Langue',
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
