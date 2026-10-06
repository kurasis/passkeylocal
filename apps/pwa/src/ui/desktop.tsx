import { useEffect, useState } from 'react';
import { configureNativeBackup, desktop, nativeStatus, retryNativeBackup, setNativeRetention } from '@platform';
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
  return <section className="card stack">
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
    <h2>Windows Hello</h2>
    <Banner kind="warn">{t('desktopHelloBlocked')}</Banner>
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
