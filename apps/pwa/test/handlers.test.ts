import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { openStorage } from '@passkey-local/vault-core';
import { VaultWorkerHandlers, toSafeError } from '../src/worker/handlers.ts';
import { urlPolicy } from '../src/ui/common.tsx';
import { DICTIONARIES, deviceLanguage, translator } from '../src/i18n.ts';

const PW = 'synthetic handler test passphrase';
const input = { title: 'Example', username: 'u@example.test', password: 'pw-1', url: 'https://example.test/', notes: 'n', tags: ['a'], customFields: [{ name: 'PIN', value: '1234', protected: true }, { name: 'Plan', value: 'basic', protected: false }], expiresAt: null };

async function handlers() {
  return new VaultWorkerHandlers(await openStorage({ indexedDB: new IDBFactory() }));
}

describe('vault worker handlers', () => {
  it('never sends secrets in list or detail views; reveal is explicit', async () => {
    const h = await handlers();
    expect((await h.handle('state', undefined)).state).toBe('empty');
    await h.handle('create', { password: PW });
    expect((await h.handle('state', undefined)).state).toBe('unlocked');
    const { uuid } = await h.handle('saveEntry', { uuid: null, input });
    const overview = await h.handle('overview', undefined);
    expect(JSON.stringify(overview)).not.toContain('pw-1');
    expect(JSON.stringify(overview)).not.toContain('1234');
    const detail = await h.handle('entryDetail', { uuid });
    expect(detail.hasPassword).toBe(true);
    expect(JSON.stringify(detail)).not.toContain('pw-1');
    expect(detail.customFields).toEqual([
      { name: 'PIN', value: null, protected: true },
      { name: 'Plan', value: 'basic', protected: false }
    ]);
    expect((await h.handle('revealField', { uuid, field: 'Password' })).value).toBe('pw-1');
    expect((await h.handle('revealField', { uuid, field: 'PIN' })).value).toBe('1234');
  });

  it('history lists changed fields and restores without losing the current state', async () => {
    const h = await handlers();
    await h.handle('create', { password: PW });
    const { uuid } = await h.handle('saveEntry', { uuid: null, input });
    const same = await h.handle('saveEntry', { uuid, input });
    expect(same.changed).toBe(false);
    await h.handle('saveEntry', { uuid, input: { ...input, password: 'pw-2' } });
    const hist = await h.handle('history', { uuid });
    expect(hist).toHaveLength(1);
    expect(hist[0]!.changedFields).toEqual(['Password']);
    expect((await h.handle('revealField', { uuid, field: 'Password', historyIndex: 0 })).value).toBe('pw-1');
    await h.handle('restoreHistory', { uuid, index: 0 });
    expect((await h.handle('revealField', { uuid, field: 'Password' })).value).toBe('pw-1');
    expect(await h.handle('history', { uuid })).toHaveLength(2);
  });

  it('moves an entry to another group on save, in one commit with the edit', async () => {
    const h = await handlers();
    await h.handle('create', { password: PW });
    const { uuid: group } = await h.handle('createGroup', { name: 'Work' });
    const { uuid } = await h.handle('saveEntry', { uuid: null, input });
    const before = (await h.handle('overview', undefined)).generation;
    const moved = await h.handle('saveEntry', { uuid, input, groupUuid: group });
    expect(moved.changed).toBe(true);
    const ov = await h.handle('overview', undefined);
    expect(ov.entries.find((e) => e.uuid === uuid)!.groupUuid).toBe(group);
    expect(ov.generation).toBe(before + 1);
    expect(await h.handle('history', { uuid })).toHaveLength(0);
    expect((await h.handle('saveEntry', { uuid, input, groupUuid: group })).changed).toBe(false);
  });

  it('recycle bin round trip and preferences validation', async () => {
    const h = await handlers();
    await h.handle('create', { password: PW });
    const { uuid } = await h.handle('saveEntry', { uuid: null, input });
    await h.handle('recycle', { uuid });
    expect((await h.handle('entryDetail', { uuid })).inRecycleBin).toBe(true);
    await h.handle('restoreFromRecycleBin', { uuid });
    expect((await h.handle('entryDetail', { uuid })).inRecycleBin).toBe(false);
    await h.handle('setPreference', { key: 'lockIntervalMs', value: 30_000 });
    expect((await h.handle('getPreferences', undefined)).lockIntervalMs).toBe(30_000);
    await h.handle('setPreference', { key: 'lockIntervalMs', value: 3_600_000 });
    expect((await h.handle('getPreferences', undefined)).lockIntervalMs).toBe(3_600_000);
    const err = await h.handle('setPreference', { key: 'lockIntervalMs', value: 0 }).catch((e: unknown) => toSafeError(e));
    expect(err).toEqual({ code: 'INVALID_INPUT', detail: 'preference' });
  });

  it('errors crossing to the UI carry only a code and detail', async () => {
    const h = await handlers();
    await h.handle('create', { password: PW });
    const err = await h.handle('unlock', { password: 'wrong password entirely' }).catch((e: unknown) => toSafeError(e));
    expect(err).toEqual({ code: 'AUTH_FAILED', detail: 'header-hmac' });
    expect(toSafeError(new Error('secret value inside'))).toEqual({ code: 'INTERNAL' });
  });
});

describe('URL policy', () => {
  it('opens https, warns for http, blocks other schemes and embedded credentials', () => {
    expect(urlPolicy('https://example.test/a')).toEqual({ kind: 'https', href: 'https://example.test/a' });
    expect(urlPolicy('http://example.test/').kind).toBe('http');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'https://user:pw@example.test/', 'example.test', '']) {
      expect(urlPolicy(bad).kind, bad).toBe('blocked');
    }
  });
});

describe('i18n', () => {
  it('picks the first supported device language', () => {
    expect(deviceLanguage(['ru-RU', 'en-US'])).toBe('ru');
    expect(deviceLanguage(['de-DE', 'en-GB', 'ru'])).toBe('en');
    expect(deviceLanguage(['de-DE'])).toBe('en');
  });
  it('has every key in both languages and substitutes variables', () => {
    expect(Object.keys(DICTIONARIES.ru).sort()).toEqual(Object.keys(DICTIONARIES.en).sort());
    for (const [k, v] of Object.entries(DICTIONARIES.ru)) expect(v.trim(), k).not.toBe('');
    expect(translator('ru')('changesSince', { n: 3 })).toBe('Изменений после последней проверенной копии: 3');
  });
});
