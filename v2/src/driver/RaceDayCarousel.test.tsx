import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/I18nProvider';
import { RaceDayCarousel } from './RaceDayCarousel';
import type { UpcomingRace } from './driverHome';

const races = ['Monaco GP', 'Japan GP', 'Great Britain GP'].map((grand_prix_name, index) => ({
  id: `race-${index}`, season_id: 'season', round_number: index + 1, grand_prix_name,
  circuit_name: '', country_code: '', race_date: '2099-10-05', race_time: '20:00', race_start_at: null,
  status: 'upcoming', weather: 'dynamic',
})) as UpcomingRace[];
let intersect: IntersectionObserverCallback;
let motionChange: () => void;
let reduce = false;
const disconnect = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem('racevora.locale', 'de');
  reduce = false;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduce; }, addEventListener: (_: string, cb: () => void) => { motionChange = cb; }, removeEventListener: vi.fn() }));
  vi.stubGlobal('IntersectionObserver', class { constructor(cb: IntersectionObserverCallback) { intersect = cb; } observe() {} disconnect = disconnect; });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function draw(entries = races) {
  return render(<MemoryRouter><I18nProvider><RaceDayCarousel races={entries} league="rcc" /></I18nProvider></MemoryRouter>);
}
function visibility(visible: boolean) { act(() => intersect([{ isIntersecting: visible, intersectionRatio: visible ? 1 : 0 } as IntersectionObserverEntry], {} as IntersectionObserver)); }
function advance(ms = 4000) { act(() => vi.advanceTimersByTime(ms)); }
it('cycles every four seconds, wraps, and keeps the correct profile link', () => {
  draw(); visibility(true); advance(3999);
  expect(screen.getByRole('heading')).toHaveTextContent('Monaco GP');
  advance(1); expect(screen.getByRole('heading')).toHaveTextContent('Japan GP');
  expect(screen.getByRole('link', { name: 'Streckenprofil' })).toHaveAttribute('href', expect.stringContaining('track=japan'));
  advance(); expect(screen.getByRole('heading')).toHaveTextContent('Great Britain GP');
  advance(); expect(screen.getByRole('heading')).toHaveTextContent('Monaco GP');
  expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'off');
});
it('manual selection pauses until explicitly restarted', () => {
  draw(); visibility(true);
  fireEvent.click(screen.getByRole('button', { name: /Japan GP/ }));
  advance(12000); expect(screen.getByRole('heading')).toHaveTextContent('Japan GP');
  expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  fireEvent.click(screen.getByRole('button', { name: /Automatischen Wechsel starten/ }));
  advance(); expect(screen.getByRole('heading')).toHaveTextContent('Great Britain GP');
  fireEvent.click(screen.getByRole('button', { name: /Automatischen Wechsel pausieren/ }));
  advance(); expect(screen.getByRole('heading')).toHaveTextContent('Great Britain GP');
});
it('stops while outside the viewport or in a hidden document', () => {
  draw(); advance(8000); expect(screen.getByRole('heading')).toHaveTextContent('Monaco GP');
  visibility(true); advance(); expect(screen.getByRole('heading')).toHaveTextContent('Japan GP');
  visibility(false); advance(); expect(screen.getByRole('heading')).toHaveTextContent('Japan GP');
  visibility(true);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  fireEvent(document, new Event('visibilitychange'));
  advance(); expect(screen.getByRole('heading')).toHaveTextContent('Japan GP');
});
it('respects reduced motion, including a preference changed while running', () => {
  reduce = true; draw(); visibility(true); advance();
  expect(screen.getByRole('heading')).toHaveTextContent('Monaco GP');
  expect(screen.queryByRole('button', { name: /Automatischen Wechsel pausieren/ })).not.toBeInTheDocument();
  reduce = false; act(() => motionChange()); advance();
  expect(screen.getByRole('heading')).toHaveTextContent('Japan GP');
  reduce = true; act(() => motionChange()); advance();
  expect(screen.getByRole('heading')).toHaveTextContent('Japan GP');
});
it('keyboard focus stops rotation and keeps manual arrows working', () => {
  draw(); visibility(true);
  const region = screen.getByRole('region', { name: 'Nächster Renntag' });
  fireEvent.focus(region); advance(); expect(screen.getByRole('heading')).toHaveTextContent('Monaco GP');
  fireEvent.keyDown(region, { key: 'ArrowRight' }); expect(screen.getByRole('heading')).toHaveTextContent('Japan GP');
});
it('cleans up timers, tolerates a replaced race list, and omits single-race controls', () => {
  const view = draw(); visibility(true);
  view.rerender(<MemoryRouter><I18nProvider><RaceDayCarousel races={[races[1]]} league="rcc" /></I18nProvider></MemoryRouter>);
  expect(screen.getByRole('heading')).toHaveTextContent('Japan GP');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  view.unmount(); expect(disconnect).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('crossfades only on a change, cleans up old photos and honors reduced motion immediately', () => {
  const view = draw();
  expect(view.container.querySelector('.race-day-transitioning')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Japan GP/ }));
  expect(view.container.querySelector('.race-day-transitioning')).not.toBeNull();
  expect(view.container.querySelector('.race-day-photo-outgoing')).toHaveAttribute('src', expect.stringContaining('monaco'));
  expect(screen.getAllByRole('link', { name: 'Streckenprofil' })).toHaveLength(1);
  advance(200);
  fireEvent.click(screen.getByRole('button', { name: /Monaco GP/ }));
  expect(screen.getByRole('heading')).toHaveTextContent('Monaco GP');
  expect(view.container.querySelector('.race-day')).toHaveStyle('--race-slide-direction: -1');
  advance(420);
  expect(view.container.querySelector('.race-day-photo-outgoing')).toBeNull();
  expect(view.container.querySelector('.race-day-transitioning')).toBeNull();
  reduce = true; act(() => motionChange());
  fireEvent.click(screen.getByRole('button', { name: /Japan GP/ }));
  expect(view.container.querySelector('.race-day-transitioning')).toBeNull();
  expect(screen.queryByText('Streckenschema')).not.toBeInTheDocument();
});
