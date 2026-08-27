import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, useI18n } from './I18nProvider';
import { messages } from './messages';

function Probe() {
  const {
    formatDate,
    formatNumber,
    language,
    plural,
    setLanguage,
  } = useI18n();

  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="number">{formatNumber(1234.5)}</span>
      <span data-testid="date">{formatDate('2026-08-20T12:00:00Z', { timeZone: 'UTC', dateStyle: 'medium' })}</span>
      <span data-testid="one">{plural('linkedRecord', 1)}</span>
      <span data-testid="many">{plural('linkedRecord', 2)}</span>
      <button type="button" onClick={() => setLanguage('fr')}>FR</button>
    </div>
  );
}

function setBrowserLanguages(...languages: string[]) {
  Object.defineProperty(navigator, 'languages', {
    configurable: true,
    value: languages,
  });
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    value: languages[0] ?? '',
  });
}

describe('I18nProvider', () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    setBrowserLanguages('de-DE');
  });

  it('lets the saved explicit choice win over browser detection', () => {
    localStorage.setItem('racevora.locale', 'fr');
    setBrowserLanguages('es-ES', 'en-US');

    render(<I18nProvider><Probe /></I18nProvider>);

    expect(screen.getByTestId('language')).toHaveTextContent('fr');
    expect(document.documentElement).toHaveAttribute('lang', 'fr');
  });

  it('detects the first supported browser language and falls back to German', () => {
    setBrowserLanguages('it-IT', 'es-ES');
    const first = render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('language')).toHaveTextContent('es');

    first.unmount();
    setBrowserLanguages('it-IT');
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('language')).toHaveTextContent('de');
  });

  it('persists an explicit language choice', () => {
    render(<I18nProvider><Probe /></I18nProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'FR' }));

    expect(screen.getByTestId('language')).toHaveTextContent('fr');
    expect(localStorage.getItem('racevora.locale')).toBe('fr');
    expect(document.documentElement).toHaveAttribute('lang', 'fr');
  });

  it('formats numbers, dates, and plural forms with the active locale', () => {
    render(<I18nProvider><Probe /></I18nProvider>);

    expect(screen.getByTestId('number').textContent).toMatch(/1[.\s]234,5/);
    expect(screen.getByTestId('date')).toHaveTextContent('20.08.2026');
    expect(screen.getByTestId('one')).toHaveTextContent('verknüpfter Fahrer');
    expect(screen.getByTestId('many')).toHaveTextContent('verknüpfte Fahrer');
  });

  it('names league_admin as league management in every visible locale', () => {
    expect(messages.de.leagueAdminRole).toBe('Ligaleitung');
    expect(messages.de['nav.admin']).toBe('Ligaleitung');
    expect(messages.en.leagueAdminRole).toBe('League management');
    expect(messages.es.leagueAdminRole).toBe('Dirección de liga');
    expect(messages.fr.leagueAdminRole).toBe('Direction de ligue');
  });
});
