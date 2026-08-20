import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  messages,
  SUPPORTED_LANGUAGES,
  type Language,
  type MessageKey,
} from './messages';

export { SUPPORTED_LANGUAGES, type Language, type MessageKey } from './messages';

const LOCALE_STORAGE_KEY = 'racevora.locale';

type MessageValues = Record<string, string | number>;
type DateInput = Date | number | string;

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, values?: MessageValues) => string;
  plural: (baseKey: string, count: number, values?: MessageValues) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLanguage(value: string | null | undefined): Language | null {
  if (!value) return null;
  const candidate = value.trim().slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(candidate as Language)
    ? candidate as Language
    : null;
}

function readStoredLanguage(): Language | null {
  try {
    return normalizeLanguage(globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages?.length) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

export function resolveInitialLanguage(): Language {
  const stored = readStoredLanguage();
  if (stored) return stored;

  for (const requested of browserLanguages()) {
    const supported = normalizeLanguage(requested);
    if (supported) return supported;
  }

  return 'de';
}

function interpolate(template: string, values: MessageValues = {}): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => (
    Object.hasOwn(values, key) ? String(values[key]) : match
  ));
}

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(resolveInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const formatNumber = (
      input: number,
      options?: Intl.NumberFormatOptions,
    ) => new Intl.NumberFormat(language, options).format(input);

    const translate = (key: MessageKey, values?: MessageValues) => {
      const template = messages[language][key] ?? messages.de[key];
      return interpolate(template, values);
    };

    return {
      language,
      setLanguage: (nextLanguage) => {
        setLanguageState(nextLanguage);
        try {
          globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, nextLanguage);
        } catch {
          // The explicit choice still applies for this session.
        }
      },
      t: translate,
      plural: (baseKey, count, values = {}) => {
        const category = new Intl.PluralRules(language).select(count);
        const candidate = `${baseKey}.${category}` as MessageKey;
        const fallback = `${baseKey}.other` as MessageKey;
        const key = Object.hasOwn(messages[language], candidate) ? candidate : fallback;
        return translate(key, { ...values, count: formatNumber(count) });
      },
      formatNumber,
      formatDate: (input, options) => new Intl.DateTimeFormat(
        language,
        options ?? { dateStyle: 'medium' },
      ).format(toDate(input)),
      formatTime: (input, options) => new Intl.DateTimeFormat(
        language,
        options ?? { timeStyle: 'short' },
      ).format(toDate(input)),
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider.');
  return context;
}
