import type { PasswordWarning } from '@passkey-local/vault-adapter';
export type HelloMode = 'session' | 'remember6' | 'remember12' | 'remember24';
export interface HelloVaultStatus { state: 'off' | 'enabled' | 'cleanup-required'; mode: HelloMode | null; expiresAt: number | null }
export interface HelloVault {
  status(): Promise<HelloVaultStatus>;
  enable(password: string, mode: HelloMode): Promise<HelloVaultStatus>;
  unlock(): Promise<{ warnings: PasswordWarning[] }>;
  disable(): Promise<HelloVaultStatus>;
}
