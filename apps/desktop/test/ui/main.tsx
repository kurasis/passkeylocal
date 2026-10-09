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
const api: FileSafeApi = {
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
      preview: "unavailable",
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
    activeReads++;
    peakReads = Math.max(peakReads, activeReads);
    if (exclusiveReads && activeReads > 1) {
      activeReads--;
      busyReads++;
      throw { code: "BUSY" };
    }
    try {
      if (exclusiveReads) await new Promise((resolve) => setTimeout(resolve, 100));
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
        return await new Promise((resolve) => {
          release = () => resolve(page);
        });
      return page;
    } finally {
      activeReads--;
    }
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
