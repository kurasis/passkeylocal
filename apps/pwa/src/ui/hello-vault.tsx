import { useEffect, useId, useRef, useState } from 'react';
import { desktop } from '@platform';
import { useT } from '../i18n.ts';
import type { HelloMode, HelloVaultStatus } from '../hello-vault-protocol.ts';
import { Banner, PasswordInput, errorText, useApp } from './common.tsx';

function message(e: unknown, t: ReturnType<typeof useT>) {
  const detail = (e as { detail?: string })?.detail;
  if (detail === 'HELLO_CANCELLED') return t('helloVaultCancelled');
  if (detail === 'HELLO_EXPIRED') return t('helloVaultExpired');
  if (detail === 'HELLO_CLEANUP_REQUIRED') return t('helloVaultCleanup');
  if (detail === 'HELLO_UNAVAILABLE') return t('helloVaultUnavailable');
  return errorText(e, t);
}
export function HelloVaultSettings() {
  const { client } = useApp();
  const t = useT();
  const modeId = useId();
  const [status, setStatus] = useState<HelloVaultStatus | null>(null);
  const [mode, setMode] = useState<HelloMode>('session');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (desktop) client.call('helloVaultStatus').then((s) => { if (alive.current) setStatus(s); }, () => {});
    return () => { alive.current = false; };
  }, [client]);
  if (!desktop) return null;
  const action = async (enable: boolean) => {
    if (busy) return;
    setBusy(true); setError(null);
    const epoch = client.epoch;
    const value = password; setPassword('');
    try {
      const s = enable ? await client.call('enableHelloVault', { password: value, mode }) : await client.call('disableHelloVault');
      if (alive.current && client.epoch === epoch) setStatus(s);
    } catch (e) {
      if (alive.current && client.epoch === epoch) {
        setError(message(e, t));
        const s = await client.call('helloVaultStatus').catch(() => null);
        if (alive.current && client.epoch === epoch) setStatus(s);
      }
    } finally { if (alive.current) setBusy(false); }
  };
  return <section className="card stack">
    <h2>{t('helloVaultTitle')}</h2>
    <p>{t('helloVaultExplain')}</p>
    <p className="muted">{t('helloVaultExperimental')}</p>
    <p role="status">{t(status?.state === 'enabled' ? 'helloVaultEnabled' : status?.state === 'cleanup-required' ? 'helloVaultCleanup' : 'helloVaultOff')}</p>
    {status?.state === 'enabled' && <p>{t(`helloVaultMode_${status.mode ?? 'session'}`)}{status.expiresAt ? ` · ${new Date(status.expiresAt).toLocaleString()}` : ''}</p>}
    {status?.state === 'off' && <form className="stack" onSubmit={(e) => { e.preventDefault(); void action(true); }}>
      <label htmlFor={modeId}>{t('helloVaultMode')}</label>
      <select id={modeId} style={{ minWidth: 0, maxWidth: '100%', width: '100%' }} value={mode} disabled={busy} onChange={(e) => setMode(e.target.value as HelloMode)}>
        {(['session', 'remember6', 'remember12', 'remember24'] as const).map((m) => <option key={m} value={m}>{t(`helloVaultMode_${m}`)}</option>)}
      </select>
      <PasswordInput label={t('masterPassword')} value={password} onChange={setPassword} autoComplete="current-password" name="hello-master-password" />
      <button type="submit" disabled={busy || !password}>{t('helloVaultEnable')}</button>
    </form>}
    {status && status.state !== 'off' && <button type="button" className="secondary" disabled={busy} onClick={() => void action(false)}>{t('helloVaultDisable')}</button>}
    {busy && <p role="status">{t('helloVaultWorking')}</p>}
    {error && <Banner kind="error">{error}</Banner>}
  </section>;
}
export function HelloVaultUnlock(props: { busy: boolean; setBusy: (v: boolean) => void; onError: (text: string | null) => void }) {
  const { client, refresh } = useApp();
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [expired, setExpired] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let live = true;
    if (desktop) client.call('helloVaultStatus').then((s) => { if (live) { setEnabled(s.state === 'enabled'); setExpired(s.state === 'cleanup-required'); } }, () => {});
    return () => { live = false; };
  }, [client]);
  if (!desktop) return null;
  const unlock = async () => {
    if (props.busy || inFlight.current) return;
    inFlight.current = true;
    const epoch = client.epoch;
    props.setBusy(true); props.onError(null);
    try {
      await client.call('unlockHelloVault');
      if (client.epoch === epoch) refresh();
    } catch (e) { if (client.epoch === epoch) props.onError(message(e, t)); }
    finally { inFlight.current = false; if (client.epoch === epoch) props.setBusy(false); }
  };
  return <>
    {enabled && <button type="button" className="secondary" disabled={props.busy} onClick={() => void unlock()}>{t('helloVaultUnlock')}</button>}
    {expired && <p className="muted">{t('helloVaultExpired')}</p>}
  </>;
}
