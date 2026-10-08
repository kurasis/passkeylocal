/** Lives only in the vault worker; no component is returned to a screen. */
import { openVault } from '@passkey-local/vault-adapter';
import { StorageError, type VaultController, type VaultStore } from '@passkey-local/vault-core';
import type { HelloMode, HelloVault, HelloVaultStatus } from '../../pwa/src/hello-vault-protocol.ts';
export interface NativeHelloReply { status: HelloVaultStatus; component?: number[]; binding?: { generation: number; sha256: string } }
export type HelloTransport = (request: Record<string, unknown>) => Promise<NativeHelloReply>;
export class NativeHelloVault implements HelloVault {
  private busy = false;
  private readonly storage: VaultStore;
  private readonly controller: VaultController;
  private readonly transport: HelloTransport;
  constructor(storage: VaultStore, controller: VaultController, transport: HelloTransport) { this.storage = storage; this.controller = controller; this.transport = transport; }
  private async call(request: Record<string, unknown>): Promise<NativeHelloReply> {
    try { return await this.transport(request); }
    catch (e) { throw new StorageError('UNAVAILABLE', (e as { code?: string })?.code ?? 'HELLO_UNAVAILABLE'); }
  }
  async status() { return (await this.call({ operation: 'status' })).status; }
  async disable() { return (await this.call({ operation: 'revoke' })).status; }
  async enable(password: string, mode: HelloMode) {
    if (this.busy) throw new StorageError('INVALID_STATE', 'busy');
    this.busy = true;
    let component: Uint8Array | undefined;
    let wire: number[] | undefined;
    try {
      const session = this.controller.current;
      if (!session || session.invalidated || session.hasUnsavedChanges || session.readOnlyReason) throw new StorageError('INVALID_STATE');
      const current = await this.storage.readCurrent();
      if (!current || current.head.generation !== session.head.generation) throw new StorageError('CONFLICT');
      // Fresh password authentication of the exact committed vault is mandatory.
      const opened = await openVault(current.blob.bytes, password);
      await opened.db.credentials.ready;
      const hash = opened.db.credentials.passwordHash;
      if (!hash) throw new StorageError('INVALID_STATE');
      component = hash.getBinary();
      await opened.db.credentials.setPassword(null);
      if (session.invalidated || this.controller.current !== session) throw new StorageError('INVALID_STATE');
      wire = Array.from(component);
      const reply = await this.call({ operation: 'enroll', mode, generation: current.head.generation, sha256: current.blob.sha256, component: wire });
      if (session.invalidated || this.controller.current !== session) throw new StorageError('INVALID_STATE');
      return reply.status;
    } finally { component?.fill(0); wire?.fill(0); this.busy = false; }
  }
  async unlock() {
    if (this.busy) throw new StorageError('INVALID_STATE', 'busy');
    this.busy = true;
    let reply: NativeHelloReply | undefined;
    let component: Uint8Array | undefined;
    try {
      reply = await this.call({ operation: 'unlock' });
      if (!reply.component || reply.component.length !== 32 || !reply.binding) throw new StorageError('INVALID_STATE');
      component = Uint8Array.from(reply.component); reply.component.fill(0);
      const opened = await this.controller.unlockWithPasswordHash(component, reply.binding);
      return { warnings: opened.warnings };
    } finally { reply?.component?.fill(0); component?.fill(0); this.busy = false; }
  }
}
