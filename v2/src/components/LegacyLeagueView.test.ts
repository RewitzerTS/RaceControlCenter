import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyLeagueSource } from './LegacyLeagueView';

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

describe('LegacyLeagueView', () => {
  it('keeps each embedded page hidden until the active theme has been applied', () => {
    const { rerender } = render(createElement(LegacyLeagueView, { page: 'kalender', title: 'Kalender' }));
    const calendarFrame = screen.getByTitle('Kalender') as HTMLIFrameElement;
    Object.defineProperty(calendarFrame, 'contentDocument', {
      configurable: true,
      value: document.implementation.createHTMLDocument('Kalender'),
    });

    expect(calendarFrame).toHaveStyle({ visibility: 'hidden' });
    fireEvent.load(calendarFrame);
    expect(calendarFrame).toHaveStyle({ visibility: 'visible' });

    rerender(createElement(LegacyLeagueView, { page: 'ergebnisse', title: 'Ergebnisse' }));
    const resultsFrame = screen.getByTitle('Ergebnisse');
    expect(resultsFrame).toHaveStyle({ visibility: 'hidden' });
  });
});
