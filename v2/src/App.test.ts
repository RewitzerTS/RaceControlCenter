import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetRouteScroll } from './App';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('route scroll restoration', () => {
  it('opens ordinary routes at the top', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);

    resetRouteScroll('');

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', left: 0, top: 0 });
  });

  it('keeps explicit fragment navigation meaningful', () => {
    const target = document.createElement('div');
    target.id = 'results';
    target.scrollIntoView = vi.fn();
    document.body.append(target);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    resetRouteScroll('#results');

    expect(target.scrollIntoView).toHaveBeenCalledOnce();
  });
});
