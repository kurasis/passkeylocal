import { useEffect, useRef, useState } from 'react';
import { biometricAvailable, biometricSecret, BiometricError, enrollBiometric } from '../biometric.ts';
import { useT } from '../i18n.ts';
import type { BiometricCredential } from '../protocol.ts';
import { Banner, Busy, PasswordInput, errorText, useApp } from './common.tsx';

function useBiometric(disabled = false) {
  const { client } = useApp();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [credential, setCredential] = useState<BiometricCredential | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    let live = true;
    biometricAvailable().then((v) => { if (live) setAvailable(v); });
    client.call('biometricCredential').then((c) => { if (live) setCredential(c); }, () => {});
    return () => { live = false; request.current?.abort(); };
  }, [client, disabled]);
  return { available, credential, setCredential, request };
}

export function BiometricUnlock(props: { busy: boolean; setBusy: (v: boolean) => void; onError: (text: string | null) => void }) {
  const { client, refresh } = useApp();
  const t = useT();
  const { available, credential, request } = useBiometric();
  const unlock = async () => {
    if (!credential || request.current) return;
    const epoch = client.epoch;
    const abort = new AbortController();
    request.current = abort;
    props.setBusy(true);
    props.onError(null);
    let prf: Uint8Array | undefined;
    try {
      prf = await biometricSecret(credential, abort.signal);
      if (client.epoch !== epoch || abort.signal.aborted) return;
      await client.call('unlockBiometric', { credentialId: credential.credentialId, prf });
      if (client.epoch === epoch && !abort.signal.aborted) refresh();
    } catch (e) {
      if (client.epoch === epoch && !abort.signal.aborted) props.onError(e instanceof BiometricError ? t(e.code) : errorText(e, t));
    } finally {
      prf?.fill(0);
      request.current = null;
      props.setBusy(false);
    }
  };
  if (!credential) return null;
  return <>
    <button type="button" className="secondary" disabled={props.busy || !available} onClick={() => void unlock()}>{t('biometricUnlock')}</button>
    {available === false && <p className="muted">{t('biometricUnavailable')}</p>}
  </>;
}

export function BiometricSettings(props: { disabled: boolean }) {
  const { client } = useApp();
  const t = useT();
  const { available, credential, setCredential, request } = useBiometric(props.disabled);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const enable = async () => {
    if (request.current) return;
    const abort = new AbortController();
    const epoch = client.epoch;
    request.current = abort;
    setBusy(true);
    setMessage(null);
    const value = password;
    setPassword('');
    let enrollment: Awaited<ReturnType<typeof enrollBiometric>> | undefined;
    try {
      enrollment = await enrollBiometric(abort.signal);
      if (abort.signal.aborted || client.epoch !== epoch) return;
      await client.call('enableBiometric', { password: value, ...enrollment });
      if (!abort.signal.aborted && client.epoch === epoch) {
        setCredential(enrollment.credential);
        setMessage({ kind: 'info', text: t('biometricEnabled') });
      }
    } catch (e) {
      if (!abort.signal.aborted && client.epoch === epoch) setMessage({ kind: 'error', text: e instanceof BiometricError ? t(e.code) : errorText(e, t) });
    } finally {
      enrollment?.prf.fill(0);
      request.current = null;
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await client.call('disableBiometric');
      setCredential(null);
      setMessage({ kind: 'info', text: t('biometricDisabled') });
    } catch (e) { setMessage({ kind: 'error', text: errorText(e, t) }); }
    finally { setBusy(false); }
  };
  return <section className="card stack">
    <h2>{t('biometricTitle')}</h2>
    <p>{t('biometricExplain')}</p>
    {credential ? <>
      <p>{t('biometricEnabled')}</p>
      <button type="button" className="secondary" disabled={busy || props.disabled} onClick={() => void disable()}>{t('biometricDisable')}</button>
    </> : available ? <form className="stack" onSubmit={(e) => { e.preventDefault(); void enable(); }}>
      <PasswordInput label={t('biometricPassword')} value={password} onChange={setPassword} autoComplete="current-password" name="biometric-password" />
      <button type="submit" disabled={!password || busy || props.disabled}>{t('biometricEnable')}</button>
    </form> : available === false ? <p className="muted">{t('biometricUnavailable')}</p> : null}
    {busy && <Busy label={t('working')} />}
    {message && <Banner kind={message.kind}>{message.text}</Banner>}
  </section>;
}
