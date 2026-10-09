/** Isolated test page. This API double is never in the production entrypoints. */
import React from "react";
import { createRoot } from "react-dom/client";
import { FileSafe } from "../../../pwa/src/ui/file-safe.tsx";
import { I18nContext, translator } from "../../../pwa/src/i18n.ts";
import type {
  FileSafeApi,
  SafeFile,
  SafeFolder,
  SafeQuery,
  SafeChange,
  SafePage,
  SafeStatus,
} from "../../../pwa/src/file-safe-protocol.ts";
import "../../../pwa/src/styles.css";
const files: SafeFile[] = Array.from({ length: 10000 }, (_, i) => ({
  id: i.toString(16).padStart(32, "0"),
  folder_id: "f".repeat(32),
  name: `Synthetic private canary ${String(i).padStart(5, "0")}`,
  tags: ["synthetic"],
  notes: "",
  favorite: false,
  deleted: false,
  size: String(9007199254740993n + BigInt(i)),
  modified_at: "2026-10-06T00:00:00.000Z",
  current_version_id: `v${i}`,
  versions: [
    {
      id: `v${i}`,
      size: "1",
      created_at: "2026-10-06T00:00:00.000Z",
      current: true,
    },
  ],
}));
let unlocked = true;
let hello: import('../../../pwa/src/hello-vault-protocol.ts').HelloVaultStatus = { state: 'off', mode: null, expiresAt: null };
let cancelHello = false;
let delayHello = false;
let releaseHello = () => {};
const helloCalls: Array<{operation: string; mode?: string}> = [];
let nativeGeneration = 0;
let deferLockedStatus = false;
let statusWaiters: Array<() => void> = [];
let lock = () => {};
let delay = false;
let release = () => {};
let exclusiveReads = false;
let activeReads = 0;
let peakReads = 0;
let busyReads = 0;
const token = "a".repeat(32);
const root = { id: "f".repeat(32), parent_id: null, name: "" };
let folders: SafeFolder[] = [root];
let explorerFiles: SafeFile[] | null = null;
const queries: SafeQuery[] = [];
const changes: SafeChange[] = [];
let revision = 0;
const fixture = new URLSearchParams(location.search).get("explorer");
if (fixture) {
  const id = (value: number) => value.toString(16).padStart(32, "0");
  if (fixture === "many") {
    folders = [root, ...Array.from({ length: 205 }, (_, i) => ({ id: id(100 + i), parent_id: root.id, name: `Folder ${String(i).padStart(3, "0")}` }))];
    explorerFiles = [];
  } else {
    folders = [root,
      { id: id(100), parent_id: root.id, name: "Documents" },
      { id: id(101), parent_id: id(100), name: "2026" },
      { id: id(102), parent_id: id(101), name: "Reports" },
      { id: id(103), parent_id: root.id, name: "Images" },
    ];
    explorerFiles = [
      { ...files[0]!, name: "Root readme.txt", size: "1024", modified_at: "2026-10-09T06:00:00.000Z" },
      { ...files[1]!, name: "Invoice.pdf", folder_id: id(100), size: "2048" },
      { ...files[2]!, name: "Nested report.csv", folder_id: id(102), size: "9007199254740993" },
      { ...files[3]!, name: "old.bin", deleted: true, size: "1" },
      { ...files[4]!, name: "Zeta.log", size: "10", favorite: true },
      { ...files[5]!, name: "Alpha.txt", size: "3072" },
    ];
  }
}
let delayPreview = false; let releasePreview = () => {}; const previewCalls: Array<{operation:string;file?:string}> = [];
const api: FileSafeApi = {
  async preview(request) {
    previewCalls.push({ operation: request.operation, ...(request.operation === "read" ? { file: request.file } : {}) });
    if (request.operation === "cancel") return null;
    if (delayPreview) await new Promise<void>((r) => releasePreview = r);
    return { request_id: request.request_id, text: "Synthetic inert <script>alert(1)</script>\nПривет 🗂\n" + Array.from({length:10000},(_,i)=>`Synthetic line ${i}`).join("\n") };
  },
  async hello(request) {
    if (request.operation === 'status') return { status: { ...hello } };
    helloCalls.push({ operation: request.operation, ...('mode' in request ? { mode: request.mode } : {}) });
    if (request.operation === 'enroll') {
      if (!unlocked || request.token !== token) throw { code: 'LOCKED' };
      if (request.password !== 'synthetic password') throw { code: 'AUTH_FAILED' };
      hello = { state: 'enabled', mode: request.mode, expiresAt: Date.now() + 21600000 };
    }
    if (request.operation === 'revoke') hello = { state: 'off', mode: null, expiresAt: null };
    if (request.operation === 'unlock') {
      if (cancelHello) { cancelHello = false; throw { code: 'HELLO_CANCELLED' }; }
      if (delayHello) {
        await new Promise<void>((resolve) => { releaseHello = resolve; });
        return { status: { ...hello }, token }; // explicit late-reply double; native state remains locked
      }
      if (request.expected_generation !== String(nativeGeneration)) throw { code: 'STALE' };
      unlocked = true; nativeGeneration++;
      return { status: { ...hello }, token };
    }
    return { status: { ...hello } };
  },
  async status() {
    if (!unlocked && deferLockedStatus)
      await new Promise<void>((resolve) => statusWaiters.push(resolve));
    return {
      exists: true,
      unlocked,
      token: unlocked ? token : null,
      generation: String(nativeGeneration),
      busy: false,
      interval_ms: 120000,
      progress: { stage: "", done: 0, total: 0 },
      backup: {
        status: "unconfigured",
        configured: false,
        retention: 10,
        completed_snapshot: null,
        pending_snapshot: null,
        retained_packages: 0,
      },
      hello: "independent-opt-in",
      preview: "txt-isolated",
    } satisfies SafeStatus;
  },
  async access(_password, _create, expectedGeneration) {
    if (expectedGeneration !== String(nativeGeneration))
      throw { code: "CANCELLED" };
    nativeGeneration++;
    unlocked = true;
    return token;
  },
  async lock() {
    unlocked = false;
    nativeGeneration++;
    lock();
  },
  async lockAll() {
    unlocked = false;
    nativeGeneration++;
    lock();
  },
  subscribeLock(callback) {
    lock = callback;
    return () => {
      lock = () => {};
    };
  },
  activity() {},
  async interval() {},
  async page(_token, query) {
    queries.push({ ...query });
    activeReads++;
    peakReads = Math.max(peakReads, activeReads);
    if (exclusiveReads && activeReads > 1) {
      activeReads--;
      busyReads++;
      throw { code: "BUSY" };
    }
    try {
      if (exclusiveReads) await new Promise((resolve) => setTimeout(resolve, 100));
      const folder = folders.find((f) => f.id === (query.folder_id ?? root.id));
      if (!folder) throw { code: "NOT_FOUND" };
      const ancestors = [folder];
      let current = folder;
      while (current.parent_id) { current = folders.find((f) => f.id === current.parent_id)!; ancestors.unshift(current); }
      const children = folders.filter((f) => f.parent_id === folder.id).sort((a, b) => a.name.localeCompare(b.name));
      const search = query.search.toLowerCase();
      const result = (explorerFiles ?? files).filter((f) => (query.mode === "trash" ? f.deleted : query.mode === "favorites" ? !f.deleted && f.favorite : !f.deleted && f.folder_id === folder.id) && (!search || [f.name, f.notes, ...f.tags].some((value) => value.toLowerCase().includes(search))));
      result.sort((a, b) => query.sort === "modified" ? b.modified_at.localeCompare(a.modified_at) : query.sort === "size" ? (BigInt(a.size) < BigInt(b.size) ? 1 : -1) : a.name.localeCompare(b.name));
      const page: SafePage = {
        snapshot_id: `s${revision}`,
        sequence: "9007199254740993",
        root_id: root.id,
        folder_id: folder.id,
        folders: children.slice(query.folder_offset, query.folder_offset + 200),
        ancestors,
        files: result.slice(query.offset, query.offset + query.limit),
        total: result.length,
        folders_total: children.length,
        storage_bytes: "9007199254740993",
      };
      if (delay)
        return await new Promise((resolve) => {
          release = () => resolve(page);
        });
      return page;
    } finally {
      activeReads--;
    }
  },
  async change(_token, _snapshot, change) {
    changes.push(change);
    if (change.kind === "folder") folders.push({ id: (1000 + revision).toString(16).padStart(32, "0"), parent_id: change.parent_id, name: change.name });
    if (change.kind === "folder_edit") folders = folders.map((f) => f.id === change.folder_id ? { ...f, name: change.name } : f);
    if (change.kind === "folder_remove") {
      if (folders.some((f) => f.parent_id === change.folder_id) || explorerFiles?.some((f) => f.folder_id === change.folder_id)) throw { code: "NOT_EMPTY" };
      folders = folders.filter((f) => f.id !== change.folder_id);
    }
    if (change.kind === "edit" && explorerFiles) explorerFiles = explorerFiles.map((f) => f.id === change.edit.file_id ? { ...f, ...change.edit } : f);
    if (change.kind === "trash" && explorerFiles) explorerFiles = explorerFiles.map((file) => change.file_ids.includes(file.id) ? { ...file, deleted: change.deleted } : file);
    revision++;
  },
  async import() {
    return null;
  },
  async importResults() {
    return [];
  },
  async cancel() {},
  async export() {
    return false;
  },
  async rotate() {},
  async backup() {
    return false;
  },
  async retryBackup() {},
  async recover() {
    return null;
  },
};
Object.assign(window, {
  uiTest: {
    queries() { return queries; },
    previewCalls() { return previewCalls; },
    delayPreview() { delayPreview = true; },
    releasePreview() { delayPreview = false; releasePreview(); },
    changes() { return changes; },
    helloCalls() { return helloCalls; },
    cancelHello() { cancelHello = true; },
    delayHello() { delayHello = true; },
    releaseHello() { delayHello = false; releaseHello(); },
    setDelay() {
      delay = true;
    },
    resumeReads() { delay = false; },
    release() {
      delay = false;
      release();
    },
    exclusiveReads() {
      exclusiveReads = true;
      peakReads = 0;
      busyReads = 0;
    },
    readCounts() { return { activeReads, peakReads, busyReads }; },
    lock() {
      unlocked = false;
      nativeGeneration++;
      lock();
    },
    deferStatus() {
      deferLockedStatus = true;
    },
    pendingStatus() {
      return statusWaiters.length;
    },
    releaseStatus() {
      deferLockedStatus = false;
      for (const resolve of statusWaiters) resolve();
      statusWaiters = [];
    },
    russian() {
      renderTest("ru");
    },
  },
});
const uiRoot = createRoot(document.getElementById("root")!);
function renderTest(lang: "en" | "ru") {
  uiRoot.render(
    <I18nContext.Provider value={{ lang, t: translator(lang) }}>
      <main>
        <FileSafe api={api} />
      </main>
    </I18nContext.Provider>,
  );
}
renderTest("en");
