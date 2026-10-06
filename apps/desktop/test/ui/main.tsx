/** Isolated test page. This API double is never in the production entrypoints. */
import React from "react";
import { createRoot } from "react-dom/client";
import { FileSafe } from "../../../pwa/src/ui/file-safe.tsx";
import { I18nContext, translator } from "../../../pwa/src/i18n.ts";
import type {
  FileSafeApi,
  SafeFile,
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
let lock = () => {};
let delay = false;
let release = () => {};
const token = "a".repeat(32);
const root = { id: "f".repeat(32), parent_id: null, name: "" };
const api: FileSafeApi = {
  async status() {
    return {
      exists: true,
      unlocked,
      token: unlocked ? token : null,
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
      hello: "unavailable",
      preview: "unavailable",
    } satisfies SafeStatus;
  },
  async access() {
    unlocked = true;
    return token;
  },
  async lock() {
    unlocked = false;
    lock();
  },
  async lockAll() {
    unlocked = false;
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
    const result = files.filter((f) => f.name.includes(query.search));
    const page: SafePage = {
      snapshot_id: "s",
      sequence: "9007199254740993",
      root_id: root.id,
      folder_id: root.id,
      folders: [],
      ancestors: [root],
      files: result.slice(query.offset, query.offset + query.limit),
      total: result.length,
      folders_total: 0,
      storage_bytes: "9007199254740993",
    };
    if (delay)
      return new Promise((resolve) => {
        release = () => resolve(page);
      });
    return page;
  },
  async change() {},
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
    setDelay() {
      delay = true;
    },
    release() {
      release();
    },
    lock() {
      unlocked = false;
      lock();
    },
  },
});
createRoot(document.getElementById("root")!).render(
  <I18nContext.Provider value={{ lang: "en", t: translator("en") }}>
    <main>
      <FileSafe api={api} />
    </main>
  </I18nContext.Provider>,
);
