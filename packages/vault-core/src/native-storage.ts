import { StorageError, type StorageErrorCode } from './errors.ts';
import type { BlobInfo, BlobRecord, CommitRequest, HeadRecord, ReceiptKind, ReceiptRecord, VaultStore } from './storage.ts';

export type NativeTransport = (operation: string, args?: Record<string, unknown>) => Promise<unknown>;
type WireBlob = Omit<BlobRecord, 'bytes'> & { bytes: number[] };

/** Worker-side adapter. Only ciphertext and operational metadata cross this boundary. */
export class NativeVaultStorage implements VaultStore {
  unhealthy = false;
  constructor(privateTransport: NativeTransport) { this.transport = privateTransport; }
  private readonly transport: NativeTransport;
  close(): void { /* The host owns its process lock. */ }
  private async call<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
    try { return await this.transport(op, args) as T; }
    catch (e) {
      const code = (e as { code?: string })?.code;
      const known = ['UNAVAILABLE', 'CONFLICT', 'QUOTA', 'WRITE_FAILED', 'READBACK_FAILED', 'CORRUPT', 'NOT_FOUND', 'INVALID_STATE'];
      if (code === 'READBACK_FAILED') this.unhealthy = true;
      throw new StorageError(known.includes(code ?? '') ? code as StorageErrorCode : 'WRITE_FAILED');
    }
  }
  readHead(): Promise<HeadRecord | null> { return this.call('readHead'); }
  async readBlob(id: string): Promise<BlobRecord> {
    const blob = await this.call<WireBlob>('readBlob', { id });
    return { ...blob, bytes: new Uint8Array(blob.bytes).buffer };
  }
  async readBlobUnchecked(id: string): Promise<Uint8Array> { return new Uint8Array(await this.call<number[]>('readBlobUnchecked', { id })); }
  async readCurrent(): Promise<{ head: HeadRecord; blob: BlobRecord } | null> {
    const head = await this.readHead();
    return head ? { head, blob: await this.readBlob(head.blobId) } : null;
  }
  listBlobs(): Promise<BlobInfo[]> { return this.call('listBlobs'); }
  commit(req: CommitRequest): Promise<HeadRecord> {
    return this.call('commit', { bytes: Array.from(req.bytes), sha256: req.sha256, expectedGeneration: req.expectedGeneration, passwordEpoch: req.passwordEpoch });
  }
  restoreBlob(blobId: string, expectedGeneration: number | null): Promise<HeadRecord> { return this.call('restoreBlob', { blobId, expectedGeneration }); }
  pruneRollback(): Promise<number> { return this.call('pruneRollback'); }
  deleteOlderPasswordEpochs(): Promise<number> { return this.call('deleteOlderPasswordEpochs'); }
  countOlderPasswordEpochs(): Promise<number> { return this.call('countOlderPasswordEpochs'); }
  addReceipt(kind: ReceiptKind, sha256: string): Promise<ReceiptRecord> { return this.call('addReceipt', { kind, sha256 }); }
  listReceipts(): Promise<ReceiptRecord[]> { return this.call('listReceipts'); }
  getPreference<T>(key: string): Promise<T | undefined> { return this.call<T | undefined>('getPreference', { key }); }
  setPreference(key: string, value: unknown, expectedGeneration?: number): Promise<void> { return this.call('setPreference', { key, value, expectedGeneration }); }
}
