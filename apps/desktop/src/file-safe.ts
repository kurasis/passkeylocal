import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { FileSafeApi } from "../../pwa/src/file-safe-protocol.ts";
let activityAt = 0;
export const fileSafe: FileSafeApi = {
  hello: (request) => invoke("file_safe_hello", { request }),
  status: () => invoke("file_safe_status"),
  access: (password, create, expectedGeneration) =>
    invoke("file_safe_access", { password, create, expectedGeneration }),
  lock: () => invoke("file_safe_lock"),
  lockAll: () => invoke("lock_all"),
  subscribeLock(callback) {
    let live = true;
    const stop = listen("file-safe-lock", () => {
      if (live) callback();
    });
    return () => {
      live = false;
      void stop.then((dispose) => dispose());
    };
  },
  activity(token) {
    if (performance.now() - activityAt < 1000) return;
    activityAt = performance.now();
    void invoke("file_safe_activity", { token }).catch(() => {});
  },
  interval: (token, millis) => invoke("file_safe_interval", { token, millis }),
  page: (token, query) => invoke("file_safe_page", { token, query }),
  change: (token, snapshot, change) =>
    invoke("file_safe_change", { token, snapshot, change }),
  import: (token, snapshot, folder, recursive, replace) =>
    invoke("file_safe_import", { token, snapshot, folder, recursive, replace }),
  importResults: (token, offset) =>
    invoke("file_safe_import_results", { token, offset }),
  cancel: (token) => invoke("file_safe_cancel", { token }),
  export: (token, file, version, acknowledge_plaintext) =>
    invoke("file_safe_export", {
      token,
      file,
      version,
      acknowledgePlaintext: acknowledge_plaintext,
    }),
  rotate: (token, snapshot, current, next) =>
    invoke("file_safe_rotate", { token, snapshot, current, next }),
  backup: (token, configure, retention) =>
    invoke("file_safe_backup", { token, configure, retention }),
  retryBackup: (token) => invoke("file_safe_retry_backup", { token }),
  recover: (password, candidate, confirm) =>
    invoke("file_safe_recover", { password, candidate, confirm }),
};
