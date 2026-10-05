/**
 * Shared UI pieces: app context, error text, file handoff, safe URLs,
 * clipboard, password input.
 */

import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import type { MessageKey, Translate } from '../i18n.ts';
import { useLang, useT } from '../i18n.ts';
import { VaultRequestError, type VaultClient } from '../vault-client.ts';
import type { FileOut } from '../protocol.ts';

export interface AppApi {
  client: VaultClient;
  /** Short status message (never contains record data). */
  notify: (message: string) => void;
  /** Re-read lifecycle state from the worker (after create/unlock/restore). */
  refresh: () => void;
  lockNow: () => void;
}

export const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const api = useContext(AppContext);
  if (!api) throw new Error('AppContext missing');
  return api;
}

export function errorCode(e: unknown): string {
  return e instanceof VaultRequestError ? e.code : 'INTERNAL';
}

export function errorText(e: unknown, t: Translate): string {
  const key = `err_${errorCode(e)}` as MessageKey;
  return t(key) === key ? t('err_INTERNAL') : t(key);
}

export function useFormatDate(): (iso: string | null | undefined) => string {
  const lang = useLang();
  return (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  };
}

export type HandoffOutcome = 'export-offered' | 'export-cancelled' | 'export-failed';

/**
 * Hand an already prepared encrypted file to the OS. Must be called directly
 * from the user's gesture. A resolved share or a download click only means the
 * file was offered; durability is established by verification later.
 */
export async function handOffFile(file: FileOut): Promise<HandoffOutcome> {
  const blob = new File([file.bytes as BlobPart], file.fileName, { type: 'application/octet-stream' });
  const nav = globalThis.navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (coarse && typeof nav.share === 'function' && nav.canShare?.({ files: [blob] })) {
    try {
      await nav.share({ files: [blob] });
      return 'export-offered';
    } catch (e) {
      return (e as { name?: string })?.name === 'AbortError' ? 'export-cancelled' : 'export-failed';
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'export-offered';
  } catch {
    return 'export-failed';
  }
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * Deliberate navigation policy for stored URLs (SECURITY_AND_FORMAT.md 5):
 * HTTPS opens, HTTP needs a warning, anything else (javascript:, data:,
 * file:, embedded credentials) never opens.
 */
export function urlPolicy(raw: string): { kind: 'https' | 'http'; href: string } | { kind: 'blocked' } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { kind: 'blocked' };
  }
  if (u.username || u.password) return { kind: 'blocked' };
  if (u.protocol === 'https:') return { kind: 'https', href: u.href };
  if (u.protocol === 'http:') return { kind: 'http', href: u.href };
  return { kind: 'blocked' };
}

export function openExternal(href: string): void {
  const w = window.open(href, '_blank', 'noopener,noreferrer');
  if (w) w.opener = null;
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** Password field: masked, optional temporary reveal, no spellcheck/autocorrect. */
export function PasswordInput(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password' | 'off';
  autoFocus?: boolean;
  name?: string;
}) {
  const t = useT();
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <div className="input-row">
        <input
          id={id}
          name={props.name}
          type={shown ? 'text' : 'password'}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          autoComplete={props.autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={props.autoFocus}
        />
        <button type="button" className="secondary" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
          {shown ? t('hide') : t('show')}
        </button>
      </div>
    </div>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  autoFocus?: boolean;
  secretish?: boolean;
}) {
  const id = useId();
  const common = {
    id,
    value: props.value,
    autoCapitalize: 'off',
    autoCorrect: 'off',
    spellCheck: props.secretish ? false : undefined,
    autoComplete: 'off',
    autoFocus: props.autoFocus
  } as const;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      {props.multiline ? (
        <textarea {...common} rows={4} onChange={(e) => props.onChange(e.target.value)} />
      ) : (
        <input {...common} type={props.type ?? 'text'} onChange={(e) => props.onChange(e.target.value)} />
      )}
    </div>
  );
}

export function Banner(props: { kind: 'info' | 'warn' | 'error'; children: ReactNode }) {
  return (
    <div className={`banner ${props.kind}`} role={props.kind === 'error' ? 'alert' : 'status'}>
      {props.children}
    </div>
  );
}

export function Busy(props: { label: string }) {
  return (
    <p className="busy" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> {props.label}
    </p>
  );
}

/** Local new-password policy mirror for instant feedback; the worker re-checks. */
export function newPasswordProblem(pw: string, repeat: string, t: Translate): string | null {
  const scalars = [...pw].length;
  if (/[\u0000\r\n]/.test(pw)) return t('passwordBadChars');
  if (scalars < 16) return t('passwordTooShort');
  if (scalars > 1024) return t('passwordTooLong');
  if (pw !== repeat) return t('passwordsDiffer');
  return null;
}
