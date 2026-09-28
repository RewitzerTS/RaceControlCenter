import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProfileLogoTheme } from './ProfileLogoTheme';
import { THEME_PRESETS, toCustomThemeColors } from '../league/leagueBranding';

const load = vi.hoisted(() => vi.fn());
vi.mock('../league/logoTheme', () => ({ themeFromLogoUrl: load }));
vi.mock('../i18n/I18nProvider', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('does not fetch before a click and forwards only the proposed colors', async () => {
  const colors = toCustomThemeColors(THEME_PRESETS[1]);
  load.mockResolvedValue({ colors, supplemented: false });
  const onColors = vi.fn();
  const onBusy = vi.fn();
  render(<ProfileLogoTheme logoUrl="https://example.invalid/logo.png" leagueName="Test" disabled={false} onColors={onColors} onBusy={onBusy} />);
  expect(load).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(onColors).toHaveBeenCalledWith(colors));
  expect(onBusy.mock.calls).toEqual([[true], [false]]);
  expect(screen.getByRole('status')).toHaveTextContent('profile.logoThemeReady');
});

it('cancels stale results after leaving the editor or switching league', async () => {
  let complete!: (value: unknown) => void;
  load.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const onColors = vi.fn();
  const onBusy = vi.fn();
  const view = render(<ProfileLogoTheme logoUrl="/old-logo.png" leagueName="Old league" disabled={false} onColors={onColors} onBusy={onBusy} />);
  fireEvent.click(screen.getByRole('button'));
  const signal = load.mock.calls[0][1] as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => { complete({ colors: toCustomThemeColors(THEME_PRESETS[1]), supplemented: false }); });
  expect(onColors).not.toHaveBeenCalled();
  expect(onBusy).toHaveBeenLastCalledWith(false);
});

it('retains the previous draft on failure and exposes retry', async () => {
  const onColors = vi.fn();
  load.mockRejectedValueOnce(new Error('blocked')).mockResolvedValueOnce({ colors: toCustomThemeColors(THEME_PRESETS[1]), supplemented: true });
  render(<ProfileLogoTheme logoUrl="/logo.png" leagueName="Test" disabled={false} onColors={onColors} onBusy={vi.fn()} />);
  fireEvent.click(screen.getByRole('button'));
  await screen.findByRole('alert');
  expect(onColors).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(onColors).toHaveBeenCalledOnce());
  expect(screen.getByRole('status')).toHaveTextContent('profile.logoThemeSupplemented');
});
