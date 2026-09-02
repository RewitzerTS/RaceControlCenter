import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/I18nProvider';
import { InstagramEditor, InstagramStudioPage } from './InstagramStudioPage';
import { canShareInstagram, instagramPng, loadInstagramAssets, shareInstagram, type InstagramDocument } from './instagram';
import { downloadGraphicFiles } from './downloadGraphics';

const roleState = vi.hoisted(() => ({ role: 'platform_owner' }));
vi.mock('../roles/RoleProvider', () => ({ useRole: () => roleState }));
vi.mock('./downloadGraphics', () => ({ downloadGraphicFiles: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./instagram', async (importOriginal) => ({
  ...await importOriginal<typeof import('./instagram')>(),
  loadInstagramAssets: vi.fn().mockResolvedValue([undefined, {}]),
  paintInstagram: vi.fn((_canvas, doc: InstagramDocument) => doc.blocks.map((block) => ({ id: block.id, x: 0, y: 0, width: 800, height: 100, lines: [block.text], overflow: block.y > 90 && block.text.length > 10 }))),
  instagramPng: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })),
  canShareInstagram: vi.fn().mockReturnValue(true),
  shareInstagram: vi.fn().mockResolvedValue(undefined),
}));

function show(ownerGate = false) {
  return render(<I18nProvider><MemoryRouter>{ownerGate ? <InstagramStudioPage /> : <InstagramEditor />}</MemoryRouter></I18nProvider>);
}
const textBox = () => screen.getByRole('textbox', { name: 'Text' });
const download = () => screen.getByRole('button', { name: 'PNG herunterladen' });
const share = () => screen.getByRole('button', { name: 'Teilen' });
async function ready() { await waitFor(() => expect(download()).toBeEnabled()); }

beforeEach(() => {
  localStorage.setItem('racevora.locale', 'de');
  roleState.role = 'platform_owner';
  vi.mocked(canShareInstagram).mockReturnValue(true);
  vi.mocked(loadInstagramAssets).mockResolvedValue([undefined, {} as HTMLImageElement]);
  vi.mocked(instagramPng).mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  vi.mocked(shareInstagram).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Instagram editor interactions', () => {
  it('denies non-owners without loading images or rendering the editor', () => {
    roleState.role = 'league_admin'; show(true);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(loadInstagramAssets).not.toHaveBeenCalled();
  });

  it('keeps independent feed and story text and supports multiple styles, deletion and undo', async () => {
    show();
    expect(download()).toBeDisabled();
    fireEvent.change(textBox(), { target: { value: 'FEED HEADLINE' } });
    fireEvent.click(screen.getByRole('button', { name: '+ H2 · Farbverlauf' }));
    fireEvent.change(textBox(), { target: { value: 'SECOND LINE' } });
    expect(screen.getByRole('combobox', { name: 'Textstil' })).toHaveValue('h2');
    fireEvent.click(screen.getByRole('radio', { name: 'Story · 9:16' }));
    expect(textBox()).toHaveValue('');
    fireEvent.change(textBox(), { target: { value: 'STORY HEADLINE' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Feed · 4:5' }));
    expect(textBox()).toHaveValue('FEED HEADLINE');
    fireEvent.click(screen.getByRole('button', { name: 'H2 SECOND LINE' }));
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect(screen.queryByRole('button', { name: 'H2 SECOND LINE' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(screen.getByRole('button', { name: 'H2 SECOND LINE' })).toBeInTheDocument();
    await ready();
  });

  it('exports repeatedly and never shares a stale PNG while edits are rendering', async () => {
    show(); fireEvent.change(textBox(), { target: { value: 'RACEVORA' } }); await ready();
    fireEvent.click(download());
    await waitFor(() => expect(downloadGraphicFiles).toHaveBeenCalledTimes(1));
    fireEvent.click(download());
    await waitFor(() => expect(downloadGraphicFiles).toHaveBeenCalledTimes(2));
    fireEvent.change(textBox(), { target: { value: 'UPDATED' } });
    expect(share()).toBeDisabled();
    await ready();
    fireEvent.click(share());
    await waitFor(() => expect(shareInstagram).toHaveBeenCalledTimes(1));
    expect(vi.mocked(shareInstagram).mock.calls[0][0].type).toBe('image/png');
  });

  it('provides a download fallback when file sharing is unavailable', async () => {
    vi.mocked(canShareInstagram).mockReturnValue(false);
    show(); fireEvent.change(textBox(), { target: { value: 'RACEVORA' } }); await ready();
    expect(share()).toBeDisabled();
    expect(screen.getByText(/Dein Browser unterstützt das Teilen/)).toBeInTheDocument();
  });

  it('moves text by pointer and keyboard and undoes a complete drag', async () => {
    const { container } = show();
    fireEvent.change(textBox(), { target: { value: 'DRAG ME' } }); await ready();
    const block = screen.getByRole('button', { name: 'Textblock 1: DRAG ME' });
    const stage = container.querySelector('.instagram-stage')!;
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ width: 400, height: 500, x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 500, toJSON() {} });
    block.setPointerCapture = vi.fn();
    fireEvent(block, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
    fireEvent(block, new MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 150 }));
    fireEvent.pointerUp(block);
    expect(screen.getByRole('spinbutton', { name: 'Von links (%)' })).toHaveValue(14);
    expect(screen.getByRole('spinbutton', { name: 'Von oben (%)' })).toHaveValue(30);
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(screen.getByRole('spinbutton', { name: 'Von links (%)' })).toHaveValue(9);
    expect(screen.getByRole('spinbutton', { name: 'Von oben (%)' })).toHaveValue(20);
    fireEvent.keyDown(block, { key: 'ArrowDown', shiftKey: true });
    expect(screen.getByRole('spinbutton', { name: 'Von oben (%)' })).toHaveValue(22);
    await ready();
  });

  it('limits blocks and duplicates without sharing a block identity', async () => {
    show(); fireEvent.change(textBox(), { target: { value: 'ORIGINAL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Duplizieren' }));
    fireEvent.change(textBox(), { target: { value: 'COPY' } });
    expect(screen.getByRole('button', { name: 'H1 ORIGINAL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H1 COPY' })).toBeInTheDocument();
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: '+ H1 · Weiß' }));
    expect(screen.getByRole('button', { name: '+ H1 · Weiß' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '+ H2 · Farbverlauf' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Duplizieren' })).toBeDisabled();
    await ready();
  });

  it('handles share cancellation without an error and recovers for another attempt', async () => {
    vi.mocked(shareInstagram).mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
    show(); fireEvent.change(textBox(), { target: { value: 'RACEVORA' } }); await ready();
    fireEvent.click(share());
    await waitFor(() => expect(share()).toBeEnabled());
    expect(screen.queryByText(/Teilen ist momentan nicht möglich/)).not.toBeInTheDocument();
    fireEvent.click(share());
    await waitFor(() => expect(shareInstagram).toHaveBeenCalledTimes(2));
  });

  it('blocks overflowing exports and enables them after correction', async () => {
    show(); fireEvent.change(textBox(), { target: { value: 'A LONG HEADLINE' } }); await ready();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Von oben (%)' }), { target: { value: '95' } });
    await screen.findByText(/Ein Textblock reicht über den Bildrand/);
    expect(download()).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Von oben (%)' }), { target: { value: '20' } });
    await ready();
  });

  it('recovers from an asset failure and a PNG encoding failure', async () => {
    vi.mocked(loadInstagramAssets).mockRejectedValueOnce(new Error('offline'));
    show();
    await screen.findByText(/Die Grafik konnte nicht erstellt werden/);
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    fireEvent.change(textBox(), { target: { value: 'RECOVERED' } }); await ready();
    vi.mocked(instagramPng).mockRejectedValueOnce(new Error('encode'));
    fireEvent.change(textBox(), { target: { value: 'NEW' } });
    await screen.findByText(/Die Grafik konnte nicht erstellt werden/);
    expect(download()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await ready();
  });
});
