/** Virtual folder/file rows. Only bounded native metadata enters this view. */
import { useEffect, useRef, useState } from "react";
import type { SafeFile, SafeFolder, SafeQuery } from "../file-safe-protocol.ts";
import { Icon } from "./icons.tsx";

function sizeLabel(bytes: string, lang: string) {
  try {
    const value = BigInt(bytes);
    const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
    let scale = 1n;
    let unit = 0;
    while (unit < units.length - 1 && value >= scale * 1024n) {
      scale *= 1024n;
      unit++;
    }
    const whole = value / scale;
    const fraction = unit ? (value % scale) * 10n / scale : 0n;
    return `${whole.toLocaleString(lang)}${fraction ? `${lang === "ru" ? "," : "."}${fraction}` : ""} ${units[unit]}`;
  } catch {
    return "—";
  }
}
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

export function FileSafeExplorer({ files, folders, parent, selected, select, detail, openFolder, sort, setSort, busy, lang, labels }: {
  files: SafeFile[];
  folders: SafeFolder[];
  parent: string | null;
  selected: string[];
  select: (id: string, checked: boolean) => void;
  detail: (id: string) => void;
  openFolder: (id: string) => void;
  sort: SafeQuery["sort"];
  setSort: (sort: SafeQuery["sort"]) => void;
  busy: boolean;
  lang: "en" | "ru";
  labels: { select: string; empty: string; files: string; name: string; ext: string; size: string; modified: string; openFolder: string; up: string; sortName: string; sortDate: string; sortSize: string };
}) {
  const [scroll, setScroll] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
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
  const end = Math.min(rows.length, start + 12);
  const heading = (label: string, value: SafeQuery["sort"], accessible: string) => <button type="button" aria-label={accessible} aria-pressed={sort === value} disabled={busy} onClick={() => setSort(value)}>{label}{sort === value && <span aria-hidden="true">{value === "name" ? "↑" : "↓"}</span>}</button>;
  return <div className="file-safe-table">
    <div className="file-safe-columns" aria-hidden="false">
      <span />
      {heading(labels.name, "name", labels.sortName)}
      <span className="file-safe-extension">{labels.ext}</span>
      {heading(labels.size, "size", labels.sortSize)}
      <span className="file-safe-date">{heading(labels.modified, "modified", labels.sortDate)}</span>
    </div>
    <div className="file-safe-viewport" ref={viewport} onScroll={(e) => setScroll(e.currentTarget.scrollTop)} role="list" aria-label={labels.files} tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const target = e.currentTarget;
        target.scrollTop = e.key === "Home" ? 0 : e.key === "End" ? rows.length * height : target.scrollTop + (e.key === "ArrowDown" ? height : -height);
      }}>
      {!rows.length && <p className="file-safe-empty">{labels.empty}</p>}
      <div style={{ height: rows.length * height, position: "relative" }}>
        {rows.slice(start, end).map((row, index) => <div className="file-safe-row" role="listitem" key={`${row.kind}:${row.id}`} data-selected={row.kind === "file" && selected.includes(row.id)}
          style={{ position: "absolute", height, top: (start + index) * height, left: 0, right: 0 }}>
          {row.kind === "file" ? <>
            <input type="checkbox" disabled={busy} aria-label={`${labels.select}: ${row.file.name}`} checked={selected.includes(row.id)} onChange={(e) => select(row.id, e.target.checked)} />
            <button type="button" className="file-safe-file" disabled={busy} onClick={() => detail(row.id)} title={row.file.name}><Icon name="file" /><span>{row.file.favorite && "★ "}{row.file.name}</span></button>
            <span className="file-safe-extension" title={extension(row.file.name)}>{extension(row.file.name)}</span>
            <span className="file-safe-size" title={`${row.file.size} B`}>{sizeLabel(row.file.size, lang)}</span>
            <span className="file-safe-date" title={row.file.modified_at}>{dateLabel(row.file.modified_at, lang)}</span>
          </> : <>
            <span />
            <button type="button" className="file-safe-file file-safe-folder" disabled={busy} aria-label={row.kind === "parent" ? labels.up : `${labels.openFolder}: ${row.folder.name}`} onClick={() => openFolder(row.id)} title={row.kind === "parent" ? labels.up : row.folder.name}>
              <Icon name={row.kind === "parent" ? "arrowUp" : "folder"} /><span>{row.kind === "parent" ? "[..]" : row.folder.name}</span>
            </button>
            <span className="file-safe-extension">—</span><span className="file-safe-size">&lt;DIR&gt;</span><span className="file-safe-date">—</span>
          </>}
        </div>)}
      </div>
    </div>
  </div>;
}
