import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppState, EmptyState } from './AppState';

describe('AppState', () => {
  it('announces loading without exposing decorative indicators', () => {
    render(<AppState copy="Kalender und Ergebnisse werden geladen." title="Racing wird vorbereitet" tone="loading" />);

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Racing wird vorbereitet')).toBeTruthy();
    expect(screen.queryByText('403')).toBeNull();
  });

  it('keeps a recovery action next to an error explanation', () => {
    render(<AppState action={<button type="button">Erneut versuchen</button>} copy="Die Daten konnten nicht geladen werden." title="Verbindung fehlgeschlagen" tone="error" />);

    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(screen.getByText('Die Daten konnten nicht geladen werden.')).toBeTruthy();
  });

  it('gives empty collections a title, explanation and next action', () => {
    render(<EmptyState action={<button type="button">Fahrer anlegen</button>} copy="Baue jetzt dein Starterfeld auf." title="Noch keine Fahrer" />);

    expect(screen.getByRole('heading', { name: 'Noch keine Fahrer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fahrer anlegen' })).toBeTruthy();
  });
});
