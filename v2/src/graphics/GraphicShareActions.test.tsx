import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { GraphicShareActions } from './GraphicShareActions';
import { downloadGraphicFiles, type GraphicDownload } from './downloadGraphics';

vi.mock('./downloadGraphics', () => ({ downloadGraphicFiles: vi.fn().mockResolvedValue(undefined) }));
const image = (name: string) => ({ blob: new Blob([name], { type: 'image/png' }), filename: name });
const files = [image('first.png'), image('second.png')];
const share = vi.fn().mockResolvedValue(undefined);
const support = vi.fn().mockReturnValue(true);
beforeEach(() => {
  localStorage.setItem('racevora.locale', 'de');
  vi.stubGlobal('navigator', { share, canShare: support });
  share.mockReset().mockResolvedValue(undefined); support.mockReset().mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const show = (prepare: () => Promise<GraphicDownload[]>, pageIndex = 0) => <I18nProvider><GraphicShareActions prepare={prepare} pageIndex={pageIndex} /></I18nProvider>;

it('shares the current PNG or every PNG directly in the click, never a ZIP or URL', async () => {
  render(show(async () => files, 1));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Dieses Bild teilen' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Dieses Bild teilen' }));
  expect(share).toHaveBeenCalledTimes(1);
  expect(share.mock.calls[0][0].files.map((file: File) => file.name)).toEqual(['second.png']);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Alle Bilder teilen' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Alle Bilder teilen' }));
  expect(share.mock.calls[1][0].files.map((file: File) => [file.name, file.type])).toEqual([['first.png','image/png'],['second.png','image/png']]);
  expect(Object.keys(share.mock.calls[1][0])).toEqual(['files']);
});

it('discards stale preparations and invalidates old images when the theme changes', async () => {
  let resolveOld!: (items: GraphicDownload[]) => void;
  const old = vi.fn(() => new Promise<GraphicDownload[]>(resolve => { resolveOld = resolve; }));
  const next = vi.fn().mockResolvedValue([image('new.png')]);
  const view = render(show(old));
  await waitFor(() => expect(old).toHaveBeenCalled());
  view.rerender(show(next));
  expect(screen.getByRole('button', { name: 'Teilen' })).toBeDisabled();
  await act(async () => resolveOld([image('old.png')]));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Teilen' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Teilen' }));
  expect(share.mock.calls[0][0].files[0].name).toBe('new.png');
  await act(async () => window.dispatchEvent(new Event('racevora:theme-changed')));
  expect(screen.getByRole('button', { name: 'Teilen' })).toBeDisabled();
  await waitFor(() => expect(next).toHaveBeenCalledTimes(2));
});

it('supports single-image-only devices and downloads the selected PNG as fallback', async () => {
  support.mockImplementation(({ files }: { files: File[] }) => files.length === 1);
  render(show(async () => files, 1));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Dieses Bild teilen' })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Alle Bilder teilen' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('jedes Bild einzeln');
  fireEvent.click(screen.getByRole('button', { name: 'Dieses Bild herunterladen' }));
  expect(vi.mocked(downloadGraphicFiles).mock.calls[0][0][0].filename).toBe('second.png');
});

it('explains unsupported sharing without starting a download or opening a target', async () => {
  support.mockImplementation(() => { throw new Error('Policy denied'); });
  render(show(async () => [files[0]]));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Browser unterstützt'));
  expect(screen.getByRole('button', { name: 'Teilen' })).toBeDisabled();
  expect(share).not.toHaveBeenCalled(); expect(downloadGraphicFiles).not.toHaveBeenCalled();
});

it('treats cancellation quietly, prevents duplicate requests and offers retry after errors', async () => {
  let reject!: (error: Error) => void;
  share.mockImplementationOnce(() => new Promise((_resolve, failure) => { reject = failure; }));
  render(show(async () => [files[0]]));
  const button = screen.getByRole('button', { name: 'Teilen' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button); fireEvent.click(button);
  expect(share).toHaveBeenCalledTimes(1);
  await act(async () => reject(new DOMException('Cancelled', 'AbortError')));
  expect(screen.getByRole('status')).not.toHaveTextContent('nicht möglich');
  share.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('nicht möglich'));
  expect(button).toBeEnabled(); expect(downloadGraphicFiles).not.toHaveBeenCalled();
});

it('can prepare again after a failed render', async () => {
  const prepare = vi.fn().mockRejectedValueOnce(new Error('Canvas failed')).mockResolvedValue([files[0]]);
  render(show(prepare));
  await screen.findByRole('button', { name: 'Erneut vorbereiten' });
  fireEvent.click(screen.getByRole('button', { name: 'Erneut vorbereiten' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Teilen' })).toBeEnabled());
});
