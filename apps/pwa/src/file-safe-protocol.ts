/** Bounded metadata and validated inert text. Keys, original document decoding and paths stay native. */
import type { HelloMode, HelloVaultStatus } from './hello-vault-protocol.ts';
export type SafeHelloRequest =
  | { operation: 'status' }
  | { operation: 'enroll'; token: string; password: string; mode: HelloMode }
  | { operation: 'unlock' | 'revoke'; expected_generation: string };
export interface SafeHelloResponse { status: HelloVaultStatus; token?: string }
export interface SafeFolder {
  id: string;
  parent_id: string | null;
  name: string;
}
export interface SafeVersion {
  id: string;
  size: string;
  created_at: string;
  current: boolean;
}
export interface SafeFile {
  id: string;
  folder_id: string;
  name: string;
  tags: string[];
  notes: string;
  favorite: boolean;
  deleted: boolean;
  size: string;
  modified_at: string;
  current_version_id: string;
  versions: SafeVersion[];
}
export interface SafeBackup {
  status: string;
  configured: boolean;
  retention: number;
  completed_snapshot: string | null;
  pending_snapshot: string | null;
  retained_packages: number;
}
export interface SafeStatus {
  exists: boolean;
  unlocked: boolean;
  token: string | null;
  generation: string;
  busy: boolean;
  interval_ms: number;
  progress: { stage: string; done: number; total: number };
  backup: SafeBackup;
  hello: "unavailable" | "independent-opt-in";
  preview: "unavailable" | "txt-isolated";
}
export interface SafeQuery {
  folder_id: string | null;
  mode: "files" | "favorites" | "trash";
  search: string;
  sort: "name" | "modified" | "size";
  offset: number;
  folder_offset: number;
  limit: number;
}
export interface SafePage {
  snapshot_id: string;
  sequence: string;
  root_id: string;
  folder_id: string;
  folders: SafeFolder[];
  ancestors: SafeFolder[];
  files: SafeFile[];
  total: number;
  folders_total: number;
  storage_bytes: string;
}
export type SafeChange =
  | { kind: "folder"; parent_id: string; name: string }
  | { kind: "folder_edit"; folder_id: string; name: string }
  | { kind: "folder_remove"; folder_id: string; confirm: boolean }
  | {
      kind: "edit";
      edit: Pick<
        SafeFile,
        "name" | "tags" | "notes" | "favorite" | "folder_id"
      > & { file_id: string };
    }
  | {
      kind: "trash";
      file_ids: string[];
      deleted: boolean;
      permanent: boolean;
      confirm: boolean;
    }
  | { kind: "restore_version"; file_id: string; version_id: string };
export interface SafeImportItem {
  index: number;
  name: string;
  status: string;
  code: string | null;
}
export interface SafeImport {
  imported: number;
  failed: number;
  skipped: number;
  cancelled: boolean;
  items: SafeImportItem[];
}
export interface SafeRecovery {
  status: "verified" | "restored_locked";
  candidate?: string;
  snapshot_id?: string;
  files?: number;
  versions?: number;
}
export interface FileSafeApi {
  preview(request: { operation: "read"; token: string; snapshot: string; file: string; version: string | null; request_id: string } | { operation: "cancel"; token: string; request_id: string }): Promise<{ request_id: string; text: string } | null>;
  hello(request: SafeHelloRequest): Promise<SafeHelloResponse>;
  status(): Promise<SafeStatus>;
  access(
    password: string,
    create: boolean,
    expectedGeneration: string,
  ): Promise<string>;
  lock(): Promise<void>;
  lockAll(): Promise<void>;
  subscribeLock(callback: () => void): () => void;
  activity(token: string): void;
  interval(token: string, millis: number): Promise<void>;
  page(token: string, query: SafeQuery): Promise<SafePage>;
  change(token: string, snapshot: string, change: SafeChange): Promise<void>;
  import(
    token: string,
    snapshot: string,
    folder: string,
    recursive: boolean,
    replace: string | null,
  ): Promise<SafeImport | null>;
  importResults(token: string, offset: number): Promise<SafeImportItem[]>;
  cancel(token: string): Promise<void>;
  export(
    token: string,
    file: string,
    version: string | null,
    acknowledge_plaintext: boolean,
  ): Promise<boolean>;
  rotate(
    token: string,
    snapshot: string,
    current: string,
    next: string,
  ): Promise<void>;
  backup(
    token: string,
    configure: boolean,
    retention: number,
  ): Promise<boolean>;
  retryBackup(token: string): Promise<void>;
  recover(
    password: string,
    candidate: string | null,
    confirm: boolean,
  ): Promise<SafeRecovery | null>;
}
