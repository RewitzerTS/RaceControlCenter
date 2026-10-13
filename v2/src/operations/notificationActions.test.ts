import { expect, it, vi } from 'vitest';
import { markAllInboxRead } from './operations';

it('marks the authenticated inbox without accepting a recipient or visible-item limit', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: '2026-10-13T12:00:00Z', error: null });
  expect(await markAllInboxRead({ rpc } as never)).toBe('2026-10-13T12:00:00Z');
  expect(rpc).toHaveBeenCalledExactlyOnceWith('mark_all_notifications_read');
  rpc.mockResolvedValue({ data: null, error: { message: 'Denied' } });
  await expect(markAllInboxRead({ rpc } as never)).rejects.toMatchObject({ message: 'Denied' });
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(markAllInboxRead({ rpc } as never)).rejects.toThrow('Invalid read confirmation');
});
