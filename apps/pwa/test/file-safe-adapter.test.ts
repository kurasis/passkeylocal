/** Native JSON unit replies must not be mistaken for cancelled dialogs. */
import { expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ fail: false }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: async (command: string) => {
  if (native.fail) throw { code: 'CONFLICT' };
  return command === 'file_safe_export' || command === 'file_safe_backup' ? false : null;
} }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
import { fileSafe } from '../../desktop/src/file-safe.ts';

it('normalizes successful native unit replies while preserving refusals and dialog cancellation', async () => {
  for (const action of [
    () => fileSafe.change('synthetic-token', 'synthetic-snapshot', { kind: 'folder', parent_id: 'synthetic-root', name: 'Synthetic folder' }),
    () => fileSafe.interval('synthetic-token', 60000),
    () => fileSafe.rotate('synthetic-token', 'synthetic-snapshot', 'synthetic-old', 'synthetic-new'),
    () => fileSafe.retryBackup('synthetic-token'),
    () => fileSafe.cancel('synthetic-token'),
    () => fileSafe.lock(),
    () => fileSafe.lockAll(),
  ]) expect(await action()).toBeUndefined();
  expect(await fileSafe.import('synthetic-token', 'synthetic-snapshot', 'synthetic-root', false, null)).toBeNull();
  expect(await fileSafe.export('synthetic-token', 'synthetic-file', null, true)).toBe(false);
  expect(await fileSafe.backup('synthetic-token', false, 10)).toBe(false);
  native.fail = true;
  await expect(fileSafe.interval('synthetic-token', 60000)).rejects.toEqual({ code: 'CONFLICT' });
  native.fail = false;
});
