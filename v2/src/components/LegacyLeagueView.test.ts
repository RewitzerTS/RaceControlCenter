import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { embeddedAppDestination, legacyLeagueSource } from './LegacyLeagueView';

vi.mock('../league/LeagueProvider', () => ({
  useLeague: () => ({ leagueSlug: 'rcc' }),
}));

import { LegacyLeagueView } from './LegacyLeagueView';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('legacyLeagueSource', () => {
  it('always replaces a stale embedded league context', () => {
    expect(legacyLeagueSource('kalender', '?league=old-league&view=archive', 'new-league'))
      .toBe('/kalender.html?league=new-league&view=archive&embed=1');
  });

  it('adds the active league to embedded pages without a league query', () => {
    expect(legacyLeagueSource('ergebnisse', '?view=drivers', 'rcc'))
      .toBe('/ergebnisse.html?view=drivers&embed=1&league=rcc');
  });
});

describe('embeddedAppDestination', () => {
  it('promotes nested Racing routes to the parent app shell', () => {
    expect(embeddedAppDestination('https://racevora.com/racing/drivers/profile?driver=driver-1', 'https://racevora.com'))
      .toBe('/racing/drivers/profile?driver=driver-1');
  });

  it('leaves legacy iframe pages inside the current shell', () => {
    expect(embeddedAppDestination('https://racevora.com/fahrer-profil.html?embed=1', 'https://racevora.com'))
      .toBeNull();
  });
});

describe('LegacyLeagueView', () => {
  it('keeps each embedded page hidden until the active theme has been applied', () => {
    const view = (page: string, title: string) => createElement(
      MemoryRouter,
      null,
      createElement(LegacyLeagueView, { page, title }),
    );
    const { rerender } = render(view('kalender', 'Kalender'));
    const calendarFrame = screen.getByTitle('Kalender') as HTMLIFrameElement;
    Object.defineProperty(calendarFrame, 'contentDocument', {
      configurable: true,
      value: document.implementation.createHTMLDocument('Kalender'),
    });

    expect(calendarFrame).toHaveStyle({ visibility: 'hidden' });
    fireEvent.load(calendarFrame);
    expect(calendarFrame).toHaveStyle({ visibility: 'visible' });

    rerender(view('ergebnisse', 'Ergebnisse'));
    const resultsFrame = screen.getByTitle('Ergebnisse');
    expect(resultsFrame).toHaveStyle({ visibility: 'hidden' });
  });
});
