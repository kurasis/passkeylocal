import { useEffect, useRef, useState } from 'react';
import { configureNativeBackup, desktop, nativeStatus, retryNativeBackup, setNativeRetention, nativeHelloStatus, verifyNativeHello, openNativeHelloSettings, proveNativeHelloKey, testNativeHelloOaep } from '@platform';
import type { HelloStatus, HelloVerificationResult, HelloKeyProof } from '../hello-protocol.ts';
import { useT } from '../i18n.ts';
import { Banner } from './common.tsx';

export function DesktopSettings() {
  const t = useT();
  const [status, setStatus] = useState<{ backup: string; hello: string; retention?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => nativeStatus().then(setStatus, () => setStatus(null));
  useEffect(() => { if (desktop) void refresh(); }, []);
  if (!desktop) return null;
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch { setStatus({ backup: 'failed', hello: 'unavailable' }); }
    finally { await refresh(); setBusy(false); }
  };
  return <><section className="card stack">
    <h2>{t('desktopBackupTitle')}</h2>
    <p>{t('desktopBackupExplain')}</p>
    <p role="status">{t(`desktopBackup_${status?.backup ?? 'unconfigured'}` as 'desktopBackup_unconfigured')}</p>
    <div className="input-row">
      <button type="button" disabled={busy} onClick={() => void action(configureNativeBackup)}>{t('desktopChooseFolder')}</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => void action(retryNativeBackup)}>{t('retry')}</button>
    </div>
    <label>{t('desktopRetention')}<select value={status?.retention ?? 30} disabled={busy} onChange={(e) => void action(() => setNativeRetention(Number(e.target.value)))}>
      {[1, 5, 10, 30, 60, 100].map((n) => <option key={n} value={n}>{n}</option>)}
    </select></label>
  </section><DesktopHelloSettings /></>;
}

export function DesktopHelloSettings() {
  const t = useT();
  const [status, setStatus] = useState<HelloStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HelloVerificationResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [proof, setProof] = useState<HelloKeyProof | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const epoch = useRef(0);
  const inFlight = useRef(false);
  const refresh = async () => {
    const attempt = ++epoch.current;
    try {
      const report = await nativeHelloStatus();
      if (epoch.current === attempt) { setStatus(report); setFailed(false); }
    } catch { if (epoch.current === attempt) { setStatus(null); setFailed(true); } }
  };
  useEffect(() => {
    if (!desktop) return;
    void refresh();
    const focus = () => { if (!inFlight.current) void refresh(); };
    window.addEventListener('focus', focus);
    return () => { epoch.current++; window.removeEventListener('focus', focus); };
  }, []);
  if (!desktop) return null;
  const action = async (kind: 'verify' | 'settings' | 'proof' | 'capability') => {
    if (inFlight.current) return;
    inFlight.current = true;
    const attempt = ++epoch.current;
    setBusy(true); setResult(null); setFailed(false);
    if (kind === 'proof' || kind === 'capability') { setProof(null); setCopied(false); setCopyFailed(false); }
    let completed = false;
    try {
      if (kind === 'verify') {
        const response = await verifyNativeHello();
        if (epoch.current === attempt) setResult(response.result);
      } else if (kind === 'proof' || kind === 'capability') {
        const response = await (kind === 'proof' ? proveNativeHelloKey() : testNativeHelloOaep());
        if (epoch.current === attempt) setProof(response);
      } else await openNativeHelloSettings();
      completed = true;
    } catch { if (epoch.current === attempt) setFailed(true); }
    finally {
      inFlight.current = false;
      if (epoch.current === attempt) { setBusy(false); if (kind === 'settings' && completed) void refresh(); }
    }
  };
  const configuration = status?.helloConfiguration ?? (failed ? 'unknown' : 'not-probed');
  const cleanupFailed = proof?.checks.some((check) => check.test === 'test-key-delete' && check.status !== 'passed') ?? false;
  return <section className="card stack" aria-labelledby="desktop-hello-title">
    <h2 id="desktop-hello-title">Windows Hello</h2>
    <p role="status">{t(`desktopHello_status_${configuration}`)}</p>
    <p>{t('desktopHelloExplain')}</p>
    <div className="input-row">
      <button type="button" disabled={busy} onClick={() => void refresh()}>{t('desktopHelloCheck')}</button>
      <button type="button" className="secondary" disabled={busy || configuration !== 'available'} onClick={() => void action('verify')}>{t('desktopHelloTest')}</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => void action('settings')}>{t('desktopHelloSettings')}</button>
    </div>
    <p>{t('desktopHelloProofExplain')}</p>
    <button type="button" disabled={busy || (configuration !== 'available' && !cleanupFailed)} onClick={() => void action('proof')}>{t('desktopHelloProof')}</button>
    <p>{t('desktopHelloCapabilityExplain')}</p>
    <button type="button" className="secondary" disabled={busy || (configuration !== 'available' && !cleanupFailed)} onClick={() => void action('capability')}>{t('desktopHelloCapability')}</button>
    {busy && <p role="status">{t('desktopHelloPending')}</p>}
    {result && <Banner kind={result === 'verified' ? 'info' : 'warn'}>{t(`desktopHello_result_${result}`)}</Banner>}
    {failed && <Banner kind="error">{t('desktopHelloError')}</Banner>}
    {proof && <div className="stack">
      <p>{t(proof.purpose === 'synthetic-oaep-capability' ? 'desktopHelloCapability' : 'desktopHelloProof')}</p>
      <Banner kind={proof.outcome === 'roundtrip-passed' || proof.outcome === 'capability-passed' ? 'info' : 'warn'}>{t(`desktopHello_proofResult_${proof.outcome}`)}</Banner>
      <ul className="hello-proof-checks">{proof.checks.filter((check) => check.status !== 'not-run').map((check) => <li key={check.test}>
        <span>{t(`desktopHello_proof_${check.test}`)}</span>
        <span>{t(`desktopHello_proofStatus_${check.status}`)}{check.nativeCode && <> <code>{check.nativeCode}</code></>}</span>
      </li>)}</ul>
      {cleanupFailed && <Banner kind="error">{t('desktopHelloProofDeleteFailed')}</Banner>}
      <details><summary>{t('desktopHelloProofReport')}</summary><pre className="hello-proof-report">{JSON.stringify(proof, null, 2)}</pre></details>
      <button type="button" className="secondary" onClick={() => void navigator.clipboard.writeText(JSON.stringify(proof, null, 2)).then(() => { setCopied(true); setCopyFailed(false); }, () => { setCopied(false); setCopyFailed(true); })}>{t('desktopHelloProofCopy')}</button>
      {copied && <p role="status">{t('desktopHelloProofCopied')}</p>}
      {copyFailed && <p role="status">{t('desktopHelloProofCopyFailed')}</p>}
    </div>}
    <p className="muted">{t('desktopHelloUnlockBlocked')}</p>
  </section>;
}

export function DesktopBackupStatus() {
  const t = useT();
  const [status, setStatus] = useState('unconfigured');
  useEffect(() => {
    if (!desktop) return;
    let live = true;
    const poll = () => nativeStatus().then((s) => { if (live) setStatus(s.backup); }, () => {});
    void poll(); const interval = setInterval(() => void poll(), 5000);
    return () => { live = false; clearInterval(interval); };
  }, []);
  if (!desktop || status === 'verified') return null;
  return <Banner kind={status === 'failed' ? 'error' : 'warn'}>{t(`desktopBackup_${status}` as 'desktopBackup_unconfigured')}</Banner>;
}
