/** Unlocked vault screens: list and search, entry detail, edit, history, recycle bin. */

import { useEffect, useMemo, useState } from 'react';
import type { EntryInput, EntryView, SearchHit } from '@passkey-local/vault-adapter';
import { useT } from '../i18n.ts';
import type { EntryDetail, HistoryItem, Overview } from '../protocol.ts';
import { Banner, Busy, PasswordInput, TextField, copyText, errorText, openExternal, urlPolicy, useApp, useFormatDate } from './common.tsx';
import { Icon } from './icons.tsx';

export type VaultView =
  | { name: 'list' }
  | { name: 'detail'; uuid: string }
  | { name: 'edit'; uuid: string | null }
  | { name: 'history'; uuid: string }
  | { name: 'historyItem'; uuid: string; index: number }
  | { name: 'recycle' };

interface Props {
  overview: Overview;
  favoritesOnly: boolean;
  view: VaultView;
  go: (v: VaultView) => void;
  reload: () => Promise<void>;
}

export function VaultScreens(props: Props) {
  const { view } = props;
  switch (view.name) {
    case 'list':
      return <EntryList {...props} />;
    case 'detail':
      return <Detail {...props} uuid={view.uuid} />;
    case 'edit':
      return <Edit {...props} uuid={view.uuid} />;
    case 'history':
      return <History {...props} uuid={view.uuid} />;
    case 'historyItem':
      return <Detail {...props} uuid={view.uuid} historyIndex={view.index} />;
    case 'recycle':
      return <EntryList {...props} recycle />;
  }
}

function initials(title: string): string {
  const s = title.trim();
  return s ? [...s][0]!.toUpperCase() : '•';
}

function EntryList(props: Props & { recycle?: boolean }) {
  const t = useT();
  const fmt = useFormatDate();
  const { client } = useApp();
  const [query, setQuery] = useState('');
  const [opts, setOpts] = useState({ includeSecrets: false, includeHistory: false, includeRecycleBin: false });
  const [showOpts, setShowOpts] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [group, setGroup] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<'title' | 'modified'>('title');
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setHits(null);
      return;
    }
    let live = true;
    const epoch = client.epoch;
    client.call('search', { query, options: opts }).then(
      (h) => live && client.epoch === epoch && setHits(h),
      () => live && setHits([])
    );
    return () => {
      live = false;
    };
  }, [query, opts, client, props.overview.generation]);

  const byUuid = useMemo(() => new Map(props.overview.entries.map((e) => [e.uuid, e])), [props.overview.entries]);
  const tags = useMemo(() => [...new Set(props.overview.entries.flatMap((e) => e.tags))].sort(), [props.overview.entries]);
  const groups = props.overview.groups.filter((g) => !g.isRecycleBin && !g.inRecycleBin);

  let rows: { entry: EntryView; hit?: SearchHit }[];
  if (hits) {
    rows = hits.flatMap((h) => {
      const entry = byUuid.get(h.uuid);
      return entry ? [{ entry, hit: h }] : [];
    });
  } else {
    rows = props.overview.entries
      .filter((e) => (props.recycle ? e.inRecycleBin : !e.inRecycleBin))
      .filter((e) => !props.favoritesOnly || e.favorite)
      .filter((e) => !group || e.groupUuid === group)
      .filter((e) => !tag || e.tags.includes(tag))
      .map((entry) => ({ entry }));
    rows.sort((a, b) =>
      sort === 'title'
        ? a.entry.title.localeCompare(b.entry.title) || a.entry.uuid.localeCompare(b.entry.uuid)
        : (b.entry.modifiedAt ?? '').localeCompare(a.entry.modifiedAt ?? '')
    );
  }

  const addGroup = async () => {
    if (!newGroup?.trim()) return;
    try {
      await client.call('createGroup', { name: newGroup.trim() });
      setNewGroup(null);
      await props.reload();
    } catch (e) {
      setError(errorText(e, t));
    }
  };

  return (
    <section className="screen">
      {!props.recycle && <div className="screen-heading">
        <div><p className="eyebrow">{t('workspaceLabel')}</p><h1>{props.favoritesOnly ? t('navFavorites') : t('navVault')}</h1><p className="screen-subtitle">{props.favoritesOnly ? t('favoritesIntro') : t('vaultIntro')}</p><span className="entry-count">{t('entryCount', { n: rows.length })}</span></div>
        {!props.overview.readOnly && <button type="button" onClick={() => props.go({ name: 'edit', uuid: null })}><Icon name="plus" />{t('addEntry')}</button>}
      </div>}
      {props.recycle ? (
        <>
          <div className="toolbar">
            <button type="button" className="link" onClick={() => props.go({ name: 'list' })}>
              ← {t('back')}
            </button>
          </div>
          <h1>{t('recycleBin')}</h1>
          <p className="muted">{t('recycleNote')}</p>
        </>
      ) : (
        <>
          <div className="search">
            <div className="search-field">
            <Icon name="search" />
            <input
              type="search"
              aria-label={t('search')}
              placeholder={t('search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            </div>
            <button type="button" className="secondary" aria-label={t('searchOptions')} aria-expanded={showOpts} onClick={() => setShowOpts((v) => !v)}>
              <Icon name="sliders" /><span className="search-options-label">{t('searchOptions')}</span>
            </button>
          </div>
          {showOpts && (
            <fieldset className="options">
              <label className="check">
                <input type="checkbox" checked={opts.includeSecrets} onChange={(e) => setOpts({ ...opts, includeSecrets: e.target.checked })} />{' '}
                {t('includeSecrets')}
              </label>
              <label className="check">
                <input type="checkbox" checked={opts.includeHistory} onChange={(e) => setOpts({ ...opts, includeHistory: e.target.checked })} />{' '}
                {t('includeHistory')}
              </label>
              <label className="check">
                <input type="checkbox" checked={opts.includeRecycleBin} onChange={(e) => setOpts({ ...opts, includeRecycleBin: e.target.checked })} />{' '}
                {t('includeRecycle')}
              </label>
            </fieldset>
          )}
          {!hits && (
            <div className="filters">
              <select aria-label={t('allGroups')} value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">{t('allGroups')}</option>
                {groups.map((g) => (
                  <option key={g.uuid} value={g.uuid}>
                    {' '.repeat(g.depth * 2)}
                    {g.name}
                  </option>
                ))}
              </select>
              {tags.length > 0 && (
                <select aria-label={t('tags')} value={tag} onChange={(e) => setTag(e.target.value)}>
                  <option value="">{t('allTags')}</option>
                  {tags.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              )}
              <select aria-label={t('sortBy')} value={sort} onChange={(e) => setSort(e.target.value as 'title' | 'modified')}>
                <option value="title">{t('sortTitle')}</option>
                <option value="modified">{t('sortModified')}</option>
              </select>
            </div>
          )}
        </>
      )}
      {rows.length === 0 ? (
        <div className="empty"><span className="empty-symbol"><Icon name={props.favoritesOnly ? 'star' : 'vault'} /></span><h2>{hits ? t('noResults') : t('noEntries')}</h2><p>{hits ? t('searchHint') : props.recycle ? t('recycleNote') : props.favoritesOnly ? t('favoritesHint') : t('emptyHint')}</p></div>
      ) : (
        <ul className="list entries">
          {rows.map(({ entry, hit }) => (
            <li key={`${entry.uuid}-${hit?.historyIndex ?? 'c'}`}>
              <button
                type="button"
                className="row"
                onClick={() =>
                  props.go(hit?.historyIndex !== undefined ? { name: 'historyItem', uuid: entry.uuid, index: hit.historyIndex } : { name: 'detail', uuid: entry.uuid })
                }
              >
                <span className={`avatar avatar-tone-${(entry.title.codePointAt(0) ?? 0) % 4}`} aria-hidden="true">
                  {initials(entry.title)}
                </span>
                <span className="row-text">
                  <span className="row-title">
                    {entry.title || '—'} {entry.favorite && <span aria-label={t('favorite')}>★</span>}
                  </span>
                  <span className="row-sub">{entry.username}</span>
                  {hit && (
                    <span className="row-sub">
                      {t('matchedIn', { fields: hit.fields.join(', ') })}
                      {hit.historyIndex !== undefined && <span className="badge">{t('olderVersion')}</span>}
                      {hit.secretMatch && <span className="badge">{t('secretMatch')}</span>}
                    </span>
                  )}
                  {props.recycle && <span className="row-sub">{fmt(entry.modifiedAt)}</span>}
                </span>
                <Icon name="chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!props.recycle && !hits && (
        <div className="stack actions">
          {newGroup === null ? (
            <button type="button" className="secondary" onClick={() => setNewGroup('')}>
              {t('newGroup')}
            </button>
          ) : (
            <form
              className="input-row"
              onSubmit={(e) => {
                e.preventDefault();
                void addGroup();
              }}
            >
              <input aria-label={t('groupName')} placeholder={t('groupName')} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} autoFocus />
              <button type="submit">{t('save')}</button>
            </form>
          )}
          <button type="button" className="link" onClick={() => props.go({ name: 'recycle' })}>
            {t('recycleBin')}
          </button>
        </div>
      )}
      {error && <Banner kind="error">{error}</Banner>}
    </section>
  );
}

/** A secret value: masked until an explicit reveal; copy without revealing. */
function SecretRow(props: { label: string; uuid: string; field: string; historyIndex?: number }) {
  const t = useT();
  const { client, notify } = useApp();
  const [value, setValue] = useState<string | null>(null);
  const fetchValue = async () => (await client.call('revealField', { uuid: props.uuid, field: props.field, historyIndex: props.historyIndex })).value;
  return (
    <div className="kv">
      <span className="k">{props.label}</span>
      <span className="v mono secret-text" aria-live="off">
        {value ?? '••••••••••••'}
      </span>
      <span className="kv-actions">
        <button type="button" className="secondary" aria-label={`${value === null ? t('reveal') : t('hide')}: ${props.label}`} onClick={async () => setValue(value === null ? await fetchValue() : null)}>
          {value === null ? t('reveal') : t('hide')}
        </button>
        <button type="button" className="secondary" aria-label={`${t('copy')}: ${props.label}`} onClick={async () => notify((await copyText(await fetchValue())) ? t('copied') : t('copyFailed'))}>
          {t('copy')}
        </button>
      </span>
    </div>
  );
}

function PlainRow(props: { label: string; value: string; copyable?: boolean }) {
  const t = useT();
  const { notify } = useApp();
  if (!props.value) return null;
  return (
    <div className="kv">
      <span className="k">{props.label}</span>
      <span className="v">{props.value}</span>
      {props.copyable && (
        <span className="kv-actions">
          <button type="button" className="secondary" aria-label={`${t('copy')}: ${props.label}`} onClick={async () => notify((await copyText(props.value)) ? t('copied') : t('copyFailed'))}>
            {t('copy')}
          </button>
        </span>
      )}
    </div>
  );
}

function Detail(props: Props & { uuid: string; historyIndex?: number }) {
  const t = useT();
  const fmt = useFormatDate();
  const { client, notify } = useApp();
  const [d, setD] = useState<EntryDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isHistory = props.historyIndex !== undefined;

  useEffect(() => {
    const p = isHistory ? client.call('historyDetail', { uuid: props.uuid, index: props.historyIndex! }) : client.call('entryDetail', { uuid: props.uuid });
    p.then(setD, (e: unknown) => setError(errorText(e, t)));
  }, [client, props.uuid, props.historyIndex, props.overview.generation, isHistory, t]);

  const act = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await props.reload();
      after?.();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  if (!d) return <section className="screen">{error ? <Banner kind="error">{error}</Banner> : <Busy label={t('working')} />}</section>;
  const url = urlPolicy(d.url);
  const ro = props.overview.readOnly;

  return (
    <section className="screen">
      <div className="toolbar">
        <button type="button" className="link" onClick={() => props.go(isHistory ? { name: 'history', uuid: props.uuid } : d.inRecycleBin ? { name: 'recycle' } : { name: 'list' })}>
          ← {t('back')}
        </button>
      </div>
      <h1>{d.title || '—'}</h1>
      {isHistory && <p className="badge">{t('versionFrom', { date: fmt(d.modifiedAt) })}</p>}
      <div className="card">
        <PlainRow label={t('username')} value={d.username} copyable />
        {d.hasPassword && <SecretRow label={t('password')} uuid={props.uuid} field="Password" historyIndex={props.historyIndex} />}
        {d.url && (
          <div className="kv">
            <span className="k">{t('url')}</span>
            <span className="v">{d.url}</span>
            <span className="kv-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (url.kind === 'blocked') return notify(t('urlNotOpenable'));
                  if (url.kind === 'http' && !window.confirm(t('httpWarning'))) return;
                  openExternal(url.href);
                }}
              >
                {t('openSite')}
              </button>
            </span>
          </div>
        )}
        {d.customFields.map((f) =>
          f.protected ? (
            <SecretRow key={f.name} label={f.name} uuid={props.uuid} field={f.name} historyIndex={props.historyIndex} />
          ) : (
            <PlainRow key={f.name} label={f.name} value={f.value ?? ''} copyable />
          )
        )}
        {d.tags.length > 0 && <PlainRow label={t('tags')} value={d.tags.join(', ')} />}
        {d.expiresAt && <PlainRow label={t('expires')} value={fmt(d.expiresAt)} />}
        <PlainRow label={t('created')} value={fmt(d.createdAt)} />
        <PlainRow label={t('modified')} value={fmt(d.modifiedAt)} />
      </div>
      {d.notes && (
        <div className="card">
          <h2>{t('notes')}</h2>
          <p className="notes">{d.notes}</p>
        </div>
      )}
      <div className="stack actions">
        {isHistory && !ro && (
          <button
            type="button"
            onClick={() =>
              window.confirm(t('restoreVersionConfirm')) &&
              act(() => client.call('restoreHistory', { uuid: props.uuid, index: props.historyIndex! }), () => props.go({ name: 'detail', uuid: props.uuid }))
            }
            disabled={busy}
          >
            {t('restoreVersion')}
          </button>
        )}
        {!isHistory && !d.inRecycleBin && !ro && (
          <>
            <button type="button" onClick={() => props.go({ name: 'edit', uuid: props.uuid })}>
              {t('edit')}
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => act(() => client.call('setFavorite', { uuid: props.uuid, favorite: !d.favorite }))}>
              {d.favorite ? t('unfavorite') : t('favorite')}
            </button>
          </>
        )}
        {!isHistory && (
          <button type="button" className="secondary" onClick={() => props.go({ name: 'history', uuid: props.uuid })}>
            {t('history')} ({d.historyCount})
          </button>
        )}
        {!isHistory && !d.inRecycleBin && !ro && (
          <button type="button" className="secondary" disabled={busy} onClick={() => act(() => client.call('recycle', { uuid: props.uuid }), () => props.go({ name: 'list' }))}>
            {t('moveToRecycle')}
          </button>
        )}
        {!isHistory && d.inRecycleBin && !ro && (
          <>
            <button type="button" disabled={busy} onClick={() => act(() => client.call('restoreFromRecycleBin', { uuid: props.uuid }))}>
              {t('restore')}
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => window.confirm(t('deleteConfirm')) && act(() => client.call('deletePermanently', { uuid: props.uuid }), () => props.go({ name: 'recycle' }))}
            >
              {t('deleteForever')}
            </button>
          </>
        )}
      </div>
      {busy && <Busy label={t('saving')} />}
      {error && <Banner kind="error">{error}</Banner>}
    </section>
  );
}

const EMPTY: EntryInput = { title: '', username: '', password: '', url: '', notes: '', tags: [], customFields: [], expiresAt: null };

function dateInputValue(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

function Edit(props: Props & { uuid: string | null }) {
  const t = useT();
  const { client, registerDraftSave } = useApp();
  const [input, setInput] = useState<EntryInput | null>(props.uuid ? null : EMPTY);
  const [tagText, setTagText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const groups = props.overview.groups.filter((g) => !g.isRecycleBin && !g.inRecycleBin);
  const currentGroup = props.uuid ? props.overview.entries.find((e) => e.uuid === props.uuid)?.groupUuid : undefined;
  const [groupUuid, setGroupUuid] = useState<string>(currentGroup ?? groups[0]?.uuid ?? '');

  useEffect(() => {
    if (!props.uuid) return;
    client.call('entryForEdit', { uuid: props.uuid }).then(
      (v) => {
        setInput(v);
        setTagText(v.tags.join(', '));
      },
      (e: unknown) => setError(errorText(e, t))
    );
  }, [client, props.uuid, t]);

  const save = async (): Promise<boolean> => {
    if (!input || busy) return false;
    setBusy(true);
    setError(null);
    try {
      const tags = tagText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await client.call('saveEntry', { uuid: props.uuid, input: { ...input, tags }, groupUuid: groupUuid || undefined });
      await props.reload();
      props.go({ name: 'detail', uuid: res.uuid });
      return true;
    } catch (e) {
      setError(errorText(e, t));
      await props.reload().catch(() => {});
      return false;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => registerDraftSave(save), [registerDraftSave, save]);
  if (!input) return <section className="screen">{error ? <Banner kind="error">{error}</Banner> : <Busy label={t('working')} />}</section>;
  const set = (patch: Partial<EntryInput>) => setInput({ ...input, ...patch });
  const extraCount = [input.url, input.notes, tagText.trim(), input.expiresAt ? 'x' : ''].filter(Boolean).length + input.customFields.length;

  return (
    <section className="screen">
      <h1>{props.uuid ? t('edit') : t('newEntry')}</h1>
      <p className="muted">{t('editDiscardWarning')}</p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField label={t('title')} value={input.title} onChange={(v) => set({ title: v })} autoFocus />
        <TextField label={t('username')} value={input.username} onChange={(v) => set({ username: v })} secretish />
        <PasswordInput label={t('password')} value={input.password} onChange={(v) => set({ password: v })} autoComplete="new-password" name="entry-password" />
        <button type="button" className="secondary" onClick={async () => set({ password: (await client.call('generatePassword', {})).value })}>
          {t('generate')}
        </button>
        {groups.length > 1 && (
          <label className="field">
            {t('group')}
            <select value={groupUuid} onChange={(e) => setGroupUuid(e.target.value)}>
              {groups.map((g) => (
                <option key={g.uuid} value={g.uuid}>
                  {'\u2003'.repeat(g.depth)}
                  {g.name || '—'}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="link" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? t('lessFields') : extraCount > 0 ? t('moreFieldsFilled', { n: extraCount }) : t('moreFields')}
        </button>
        {more && (
          <>
            <TextField label={t('url')} value={input.url} onChange={(v) => set({ url: v })} type="url" secretish />
            <TextField label={t('notes')} value={input.notes} onChange={(v) => set({ notes: v })} multiline />
            <TextField label={t('tagsHint')} value={tagText} onChange={setTagText} />
            <div className="field">
              <label>
                {t('expires')}
                <input type="date" value={dateInputValue(input.expiresAt)} onChange={(e) => set({ expiresAt: e.target.value ? new Date(`${e.target.value}T00:00:00Z`) : null })} />
              </label>
            </div>
            <fieldset className="stack">
              <legend>{t('customFields')}</legend>
              {input.customFields.map((f, i) => (
                <div key={i} className="card stack">
                  <TextField label={t('fieldName')} value={f.name} onChange={(v) => set({ customFields: input.customFields.map((x, j) => (j === i ? { ...x, name: v } : x)) })} />
                  {f.protected ? (
                    <PasswordInput label={t('fieldValue')} value={f.value} onChange={(v) => set({ customFields: input.customFields.map((x, j) => (j === i ? { ...x, value: v } : x)) })} autoComplete="off" />
                  ) : (
                    <TextField label={t('fieldValue')} value={f.value} onChange={(v) => set({ customFields: input.customFields.map((x, j) => (j === i ? { ...x, value: v } : x)) })} />
                  )}
                  <label className="check">
                    <input type="checkbox" checked={f.protected} onChange={(e) => set({ customFields: input.customFields.map((x, j) => (j === i ? { ...x, protected: e.target.checked } : x)) })} /> {t('secretField')}
                  </label>
                  <button type="button" className="secondary" onClick={() => set({ customFields: input.customFields.filter((_, j) => j !== i) })}>
                    {t('remove')}
                  </button>
                </div>
              ))}
              <button type="button" className="secondary" onClick={() => set({ customFields: [...input.customFields, { name: '', value: '', protected: false }] })}>
                {t('addField')}
              </button>
            </fieldset>
          </>
        )}
        <div className="input-row">
          <button type="submit" disabled={busy}>
            {t('save')}
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={() => props.go(props.uuid ? { name: 'detail', uuid: props.uuid } : { name: 'list' })}>
            {t('cancel')}
          </button>
        </div>
        {busy && <Busy label={t('saving')} />}
        {error && <Banner kind="error">{error}</Banner>}
      </form>
    </section>
  );
}

function History(props: Props & { uuid: string }) {
  const t = useT();
  const fmt = useFormatDate();
  const { client } = useApp();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    client.call('history', { uuid: props.uuid }).then(setItems, (e: unknown) => setError(errorText(e, t)));
  }, [client, props.uuid, props.overview.generation, t]);
  return (
    <section className="screen">
      <div className="toolbar">
        <button type="button" className="link" onClick={() => props.go({ name: 'detail', uuid: props.uuid })}>
          ← {t('back')}
        </button>
      </div>
      <h1>{t('historyTitle')}</h1>
      <p className="muted">{t('historyExplain')}</p>
      {items && items.length === 0 && <p className="empty">{t('historyEmpty')}</p>}
      <ul className="list">
        {items?.map((h) => (
          <li key={h.index}>
            <button type="button" className="row" onClick={() => props.go({ name: 'historyItem', uuid: props.uuid, index: h.index })}>
              <span className="row-text">
                <span className="row-title">{fmt(h.modifiedAt)}</span>
                <span className="row-sub">{t('changedFields', { fields: h.changedFields.join(', ') || '—' })}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && <Banner kind="error">{error}</Banner>}
    </section>
  );
}
