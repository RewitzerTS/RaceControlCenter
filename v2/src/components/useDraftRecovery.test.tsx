import { act, cleanup, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraftRecovery } from './useDraftRecovery';

function useExample(scope: string) {
  const [value, setValue] = useState({ name: '' });
  const draft = useDraftRecovery({ scope, value, restore: setValue,
    validate: (candidate): candidate is typeof value => Boolean(candidate && typeof candidate === 'object' && 'name' in candidate && typeof candidate.name === 'string'),
  });
  return { value, setValue, draft };
}

describe('tab-scoped draft recovery', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it('restores unsaved work after unmount and removes the draft after a successful save', () => {
    const first = renderHook(() => useExample('user:league:season'));
    act(() => first.result.current.setValue({ name: 'My season' }));
    expect(first.result.current.draft.dirty).toBe(true);
    first.unmount();
    const restored = renderHook(() => useExample('user:league:season'));
    expect(restored.result.current.value.name).toBe('My season');
    expect(restored.result.current.draft.restored).toBe(true);
    act(() => restored.result.current.draft.markSaved());
    expect(restored.result.current.draft.dirty).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });
  it('does not leak another account, league or season draft', () => {
    const first = renderHook(() => useExample('alice:league-a:season-a'));
    act(() => first.result.current.setValue({ name: 'Private draft' }));
    first.unmount();
    for (const scope of ['bob:league-a:season-a', 'alice:league-b:season-a', 'alice:league-a:season-b']) {
      const other = renderHook(() => useExample(scope));
      expect(other.result.current.value.name).toBe('');
      other.unmount();
    }
  });
  it('ignores expired and malformed drafts', () => {
    sessionStorage.setItem('racevora.draft.v1:a', JSON.stringify({ savedAt: 0, value: { name: 'Old' } }));
    sessionStorage.setItem('racevora.draft.v1:b', JSON.stringify({ savedAt: Date.now(), value: { name: 42 } }));
    expect(renderHook(() => useExample('a')).result.current.value.name).toBe('');
    expect(renderHook(() => useExample('b')).result.current.value.name).toBe('');
  });
  it('warns on unload and tolerates unavailable browser storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const { result } = renderHook(() => useExample('c'));
    act(() => result.current.setValue({ name: 'Still editable' }));
    expect(result.current.draft.unavailable).toBe(true);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
