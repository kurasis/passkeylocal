/** Virtual folder/file rows. Only bounded native metadata enters this view. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SafeFile, SafeFolder, SafeQuery } from "../file-safe-protocol.ts";
import { Icon } from "./icons.tsx";

import { formatFileSize } from "./common.tsx";

function extension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toUpperCase() : "—";
}
function dateLabel(value: string, lang: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(lang, {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function FileSafeExplorer({ files, folders, parent, selected, select, detail, openFolder, context, sort, setSort, busy, lang, labels }: {
  files: SafeFile[];
  folders: SafeFolder[];
  parent: string | null;
  selected: string[];
  select: (id: string, checked: boolean) => void;
  detail: (id: string) => void;
  openFolder: (id: string) => void;
  context: (target: { kind: "file" | "folder"; id: string }, x: number, y: number, anchor: HTMLElement) => void;
  sort: SafeQuery["sort"];
  setSort: (sort: SafeQuery["sort"]) => void;
  busy: boolean;
  lang: "en" | "ru";
  labels: { select: string; empty: string; files: string; name: string; ext: string; size: string; modified: string; openFolder: string; up: string; sortName: string; sortDate: string; sortSize: string };
}) {
  const [scroll, setScroll] = useState(0);
  const [windowRows, setWindowRows] = useState(12);
  const viewport = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWindowRows(Math.min(24, Math.max(12, Math.ceil(node.clientHeight / 52) + 4))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
    setScroll(0);
  }, [files, folders, parent]);
  const rows = [
    ...(parent ? [{ kind: "parent" as const, id: parent }] : []),
    ...folders.map((folder) => ({ kind: "folder" as const, id: folder.id, folder })),
    ...files.map((file) => ({ kind: "file" as const, id: file.id, file })),
  ];
  const height = 52;
  const start = Math.max(0, Math.floor(scroll / height) - 2);
  const end = Math.min(rows.length, start + windowRows);
  const key = (row: typeof rows[number]) => `${row.kind}:${row.id}`;
  // Keep the focused row mounted even when it is outside the visible window.
  const indices = new Set(Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i));
  const focusedIndex = rows.findIndex((row) => key(row) === focused);
  if (focusedIndex >= 0) indices.add(focusedIndex);
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const row = [...(viewport.current?.querySelectorAll<HTMLElement>('[data-row-key]') ?? [])].find((node) => node.dataset.rowKey === pendingFocus.current);
    row?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    if (row) pendingFocus.current = null;
  });
  const moveFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || event.ctrlKey || event.altKey || !rows.length) return;
    const origin = (event.target as HTMLElement).closest<HTMLElement>('[data-row-key]');
    if (!origin && event.target !== event.currentTarget) return;
    event.preventDefault();
    const current = origin ? rows.findIndex((row) => key(row) === origin.dataset.rowKey) : -1;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
    const row = rows[index]!;
    pendingFocus.current = key(row);
    setFocused(key(row));
    const node = viewport.current!;
    const top = index * height;
    const visibleHeight = node.clientHeight - 42;
    if (top < node.scrollTop) node.scrollTop = top;
    else if (top + height > node.scrollTop + visibleHeight) node.scrollTop = top + height - visibleHeight;
    setScroll(node.scrollTop);
  };
  const heading = (label: string, value: SafeQuery['sort'], accessible: string) => <th scope="col" aria-sort={sort === value ? value === 'name' ? 'ascending' : 'descending' : 'none'}><button type="button" aria-label={accessible} aria-pressed={sort === value} disabled={busy} onClick={() => setSort(value)}>{label}{sort === value && <span aria-hidden="true">{value === 'name' ? '↑' : '↓'}</span>}</button></th>;
  return <div className="file-safe-table">
    <div className="file-safe-viewport" ref={viewport} onScroll={(e) => setScroll(e.currentTarget.scrollTop)}>
    <table className="file-safe-data" aria-label={labels.files} aria-rowcount={rows.length ? rows.length + 1 : 2} tabIndex={0} onKeyDown={moveFocus}>
      <thead><tr className="file-safe-columns">
        <th scope="col"><span className="sr-only">{labels.select}</span></th>
        {heading(labels.name, 'name', labels.sortName)}
        <th scope="col" className="file-safe-extension">{labels.ext}</th>
        {heading(labels.size, 'size', labels.sortSize)}
        <th scope="col" className="file-safe-date" aria-sort={sort === 'modified' ? 'descending' : 'none'}><button type="button" aria-label={labels.sortDate} aria-pressed={sort === 'modified'} disabled={busy} onClick={() => setSort('modified')}>{labels.modified}{sort === 'modified' && <span aria-hidden="true">↓</span>}</button></th>
      </tr></thead>
      <tbody style={{ height: rows.length ? rows.length * height : 96, position: 'relative' }}>
        {!rows.length && <tr><td colSpan={5} className="file-safe-empty">{labels.empty}</td></tr>}
        {[...indices].sort((a, b) => a - b).map((index) => { const row = rows[index]!; return <tr className="file-safe-row" key={key(row)} data-row-key={key(row)} aria-rowindex={index + 2} data-selected={row.kind === 'file' && selected.includes(row.id)}
          onFocusCapture={() => setFocused(key(row))}
          style={{ position: 'absolute', height, top: index * height, left: 0, right: 0 }}
          onContextMenu={(event) => { if (row.kind === 'parent' || busy) return; event.preventDefault(); context({ kind: row.kind, id: row.id }, event.clientX, event.clientY, event.currentTarget.querySelector<HTMLButtonElement>('button')!); }}
          onKeyDown={(event) => { if (row.kind === 'parent' || busy || !(event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey)) return; event.preventDefault(); const anchor = event.currentTarget.querySelector<HTMLButtonElement>('button')!; const bounds = anchor.getBoundingClientRect(); context({ kind: row.kind, id: row.id }, bounds.left, bounds.bottom, anchor); }}>
          {row.kind === 'file' ? <>
            <td><input type="checkbox" disabled={busy} aria-label={`${labels.select}: ${row.file.name}`} checked={selected.includes(row.id)} onChange={(e) => select(row.id, e.target.checked)} /></td>
            <td><button type="button" className="file-safe-file" disabled={busy} onClick={() => detail(row.id)} title={row.file.name}><Icon name="file" /><span>{row.file.favorite && '★ '}{row.file.name}</span></button></td>
            <td className="file-safe-extension" title={extension(row.file.name)}>{extension(row.file.name)}</td>
            <td className="file-safe-size" title={`${row.file.size} B`}>{formatFileSize(row.file.size, lang)}</td>
            <td className="file-safe-date" title={row.file.modified_at}>{dateLabel(row.file.modified_at, lang)}</td>
          </> : <>
            <td />
            <td><button type="button" className="file-safe-file file-safe-folder" disabled={busy} aria-label={row.kind === 'parent' ? labels.up : `${labels.openFolder}: ${row.folder.name}`} onClick={() => openFolder(row.id)} title={row.kind === 'parent' ? labels.up : row.folder.name}>
              <Icon name={row.kind === 'parent' ? 'arrowUp' : 'folder'} /><span>{row.kind === 'parent' ? '[..]' : row.folder.name}</span>
            </button></td>
            <td className="file-safe-extension">—</td><td className="file-safe-size">&lt;DIR&gt;</td><td className="file-safe-date">—</td>
          </>}
        </tr>; })}
      </tbody>
    </table>
    </div>
  </div>;
}
