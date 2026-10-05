import { describe, expect, test } from 'vitest';
import {
  changedFieldNames,
  createEntry,
  createGroup,
  createVault,
  deletePermanently,
  findEntry,
  listEntries,
  listGroups,
  moveEntry,
  moveToRecycleBin,
  openVault,
  readEntry,
  restoreFromRecycleBin,
  restoreHistory,
  searchEntries,
  serializeVerified,
  setFavorite,
  toRecoveryModel,
  updateEntry
} from '../src/index.ts';
import { PASSWORD, entryInput } from './helpers.ts';

describe('DATA-08 history', () => {
  test('a real change stores the full previous state once; a no-op save stores nothing', () => {
    const { db } = createVault({ password: PASSWORD });
    const id = createEntry(db, entryInput({ password: 'v1', tags: ['work'] }));
    setFavorite(db, id, true);
    expect(updateEntry(db, id, entryInput({ password: 'v1', tags: ['work'] }))).toBe(false);
    expect(findEntry(db, id).history).toHaveLength(0);

    expect(updateEntry(db, id, entryInput({ password: 'v2', tags: ['work'] }))).toBe(true);
    const e = findEntry(db, id);
    expect(e.history).toHaveLength(1);
    expect(readEntry(db, id, 0).password).toBe('v1');
    // CustomData (favorite) is part of the stored history state.
    expect(e.history[0]!.customData?.get('LocalVault.Favorite')?.value).toBe('true');
    expect(changedFieldNames(e.history[0]!, e)).toEqual(['Password']);
  });

  test('restore makes an old state current and keeps the former current state', () => {
    const { db } = createVault({ password: PASSWORD });
    const id = createEntry(db, entryInput({ password: 'v1' }));
    updateEntry(db, id, entryInput({ password: 'v2' }));
    updateEntry(db, id, entryInput({ password: 'v3', notes: 'third' }));
    restoreHistory(db, id, 0);
    const e = findEntry(db, id);
    expect(readEntry(db, id).password).toBe('v1');
    expect(e.history.map((_, i) => readEntry(db, id, i).password)).toEqual(['v1', 'v2', 'v3']);
    // UUID is stable and history is never nested.
    expect(e.history.every((h) => h.history.length === 0)).toBe(true);
  });

  test('history (including a historical password) survives serialization', async () => {
    const { db } = createVault({ password: PASSWORD });
    const id = createEntry(db, entryInput({ password: 'old-pw' }));
    updateEntry(db, id, entryInput({ password: 'new-pw' }));
    const re = await openVault((await serializeVerified(db)).bytes, PASSWORD);
    expect(readEntry(re.db, id, 0).password).toBe('old-pw');
    expect(toRecoveryModel(re.db)).toEqual(toRecoveryModel(db));
  });

  test('expiry changes create history; validation rejects bad input', () => {
    const { db } = createVault({ password: PASSWORD });
    const id = createEntry(db, entryInput());
    expect(updateEntry(db, id, entryInput({ expiresAt: new Date('2027-03-28T01:30:00Z') }))).toBe(true);
    expect(() => updateEntry(db, id, entryInput({ tags: ['a,b'] }))).toThrow(expect.objectContaining({ detail: 'tag-forbidden-character' }));
    expect(() => updateEntry(db, id, entryInput({ customFields: [{ name: 'Password', value: '', protected: true }] }))).toThrow(
      expect.objectContaining({ detail: 'custom-field-name-reserved' })
    );
    expect(findEntry(db, id).history).toHaveLength(1);
  });
});

describe('recycle bin', () => {
  test('move, restore to the original group, and permanent delete', () => {
    const { db } = createVault({ password: PASSWORD });
    const g = createGroup(db, 'Email');
    const id = createEntry(db, entryInput({ password: 'v1' }), g);
    updateEntry(db, id, entryInput({ password: 'v2' }));
    moveToRecycleBin(db, id);
    let view = listEntries(db).find((v) => v.uuid === id)!;
    expect(view.inRecycleBin).toBe(true);
    expect(findEntry(db, id).history).toHaveLength(1);
    restoreFromRecycleBin(db, id);
    view = listEntries(db).find((v) => v.uuid === id)!;
    expect(view).toMatchObject({ inRecycleBin: false, groupUuid: g });
    expect(() => deletePermanently(db, id)).toThrow(expect.objectContaining({ detail: 'not-in-recycle-bin' }));
    moveToRecycleBin(db, id);
    deletePermanently(db, id);
    expect(listEntries(db).some((v) => v.uuid === id)).toBe(false);
    expect(db.deletedObjects.length).toBe(1);
  });
});

describe('moveEntry', () => {
  test('moves between groups without a history item and refuses the recycle bin', async () => {
    const { db } = createVault({ password: PASSWORD });
    const a = createGroup(db, 'Personal');
    const b = createGroup(db, 'Work');
    const id = createEntry(db, entryInput({ password: 'v1' }), a);
    expect(moveEntry(db, id, b)).toBe(true);
    expect(moveEntry(db, id, b)).toBe(false);
    expect(listEntries(db).find((v) => v.uuid === id)).toMatchObject({ groupUuid: b, inRecycleBin: false });
    expect(findEntry(db, id).history).toHaveLength(0);
    const bin = listGroups(db).find((g) => g.isRecycleBin)!.uuid;
    expect(() => moveEntry(db, id, bin)).toThrow(expect.objectContaining({ detail: 'target-in-recycle-bin' }));
    moveToRecycleBin(db, id);
    expect(() => moveEntry(db, id, a)).toThrow(expect.objectContaining({ detail: 'entry-in-recycle-bin' }));
    restoreFromRecycleBin(db, id);
    const reopened = await openVault((await serializeVerified(db)).bytes, PASSWORD);
    expect(listEntries(reopened.db).find((v) => v.uuid === id)).toMatchObject({ groupUuid: b });
  });
});

describe('search', () => {
  test('literal, normalized, secrets masked by default, history hits labelled', () => {
    const { db } = createVault({ password: PASSWORD });
    const a = createEntry(db, entryInput({ title: 'Ｍａｉｌ Provider', password: 'needle-in-secret', tags: ['Personal'] }));
    updateEntry(db, a, entryInput({ title: 'Ｍａｉｌ Provider', password: 'other', tags: ['Personal'] }));
    createEntry(db, entryInput({ title: 'Bank (.*)', username: 'x' }));
    expect(searchEntries(db, 'mail').map((h) => h.uuid)).toEqual([a]);
    expect(searchEntries(db, '(.*)')).toHaveLength(1);
    expect(searchEntries(db, 'needle')).toHaveLength(0);
    expect(searchEntries(db, 'needle', { includeSecrets: true })).toHaveLength(0);
    const hits = searchEntries(db, 'needle', { includeSecrets: true, includeHistory: true });
    expect(hits).toEqual([{ uuid: a, historyIndex: 0, fields: ['Password'], secretMatch: true }]);
    expect(searchEntries(db, 'personal')[0]!.fields).toEqual(['Tags']);
    expect(searchEntries(db, '')).toEqual([]);
  });
});

describe('listGroups', () => {
  test('returns the tree depth-first and marks the recycle bin', () => {
    const { db } = createVault({ password: PASSWORD });
    const work = createGroup(db, 'Work');
    createGroup(db, 'Inner', work);
    const groups = listGroups(db);
    expect(groups[0]).toMatchObject({ depth: 0, parentUuid: null, isRecycleBin: false });
    const names = groups.map((g) => [g.name, g.depth, g.isRecycleBin]);
    expect(names).toContainEqual(['Work', 1, false]);
    expect(names).toContainEqual(['Inner', 2, false]);
    expect(groups.filter((g) => g.isRecycleBin)).toHaveLength(1);
  });
});
