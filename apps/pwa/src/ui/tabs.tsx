/** Backups and Settings tabs. */

import { useEffect, useState } from 'react';
import type { BackupStatus } from '@passkey-local/vault-core';
import { LOCK_INTERVALS_MS } from '@passkey-local/vault-core/autolock';
import { useT } from '../i18n.ts';
import type { Preferences } from '../protocol.ts';
import { ExportControl, RestoreControl, VerifyControl } from './backup-tools.tsx';
import { BiometricSettings } from './biometric.tsx';
import { ThemePicker } from './theme.tsx';
import { Banner, Busy, PasswordInput, errorText, newPasswordProblem, useApp, useFormatDate } from './common.tsx';

export function BackupStatusBanner(props: { status: BackupStatus | null }) {
  const t = useT();
  const s = props.status;
  if (!s || !s.savedLocally || s.changesSinceVerified === 0) return null;
  return s.escalate ? <Banner kind="warn">{t('backupUrgent')}</Banner> : <p className="reminder">{t('backupReminder')}</p>;
}

export function BackupsTab(props: {
  status: BackupStatus | null;
  persistence: string;
  storageUnhealthy: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const fmt = useFormatDate();
  const [restore, setRestore] = useState(false);
  const s = props.status;
  return (
    <section className="screen">
      <h1>{t('backupsTitle')}</h1>
      <div className="card stack">
        <p>{s?.savedLocally ? `✓ ${t('savedLocally')}` : t('notSavedLocally')}</p>
        <p>
          {s?.latestExport
            ? t('lastExport', {
                status: t(`exportStatus_${s.latestExport.kind.replace(/-/g, '_')}` as 'exportStatus_export_offered'),
                date: fmt(s.latestExport.at)
              })
            : t('neverExported')}
        </p>
        <p>{s?.latestVerified ? t('lastVerified', { date: fmt(s.latestVerified.at) }) : t('neverVerified')}</p>
        <p>{s && s.changesSinceVerified > 0 ? t('changesSince', { n: s.changesSinceVerified }) : t('upToDate')}</p>
      </div>
      <BackupStatusBanner status={s} />
      <h2>{t('saveBackup')}</h2>
      <ExportControl onOffered={props.onChanged} />
      <h2>{t('verifyBackup')}</h2>
      <VerifyControl onVerified={props.onChanged} />
      <h2>{t('storageTitle')}</h2>
      <p>{t(`persistence_${props.persistence.replace(/-/g, '_')}` as 'persistence_unavailable')}</p>
      {props.storageUnhealthy && <Banner kind="error">{t('storageUnhealthy')}</Banner>}
      <h2>{t('restoreTitle')}</h2>
      {restore ? (
        <RestoreControl replacing onDone={props.onChanged} />
      ) : (
        <button type="button" className="secondary" onClick={() => setRestore(true)}>
          {t('restoreVault')}
        </button>
      )}
    </section>
  );
}

export function SettingsTab(props: { prefs: Preferences; setPref: (key: keyof Preferences, value: unknown) => void; onPasswordChanged: () => void }) {
  const t = useT();
  const { client } = useApp();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'info' | 'warn' | 'error'; text: string } | null>(null);
  const [offline, setOffline] = useState<boolean | null>(null);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return setOffline(false);
    sw.getRegistration().then((r) => setOffline(!!r?.active), () => setOffline(false));
  }, []);

  const change = async () => {
    const problem = newPasswordProblem(next, repeat, t);
    if (problem) return setMsg({ kind: 'error', text: problem });
    setBusy(true);
    setMsg(null);
    try {
      const c = cur;
      const n = next;
      setCur('');
      setNext('');
      setRepeat('');
      const r = await client.call('changePassword', { current: c, next: n });
      setMsg({ kind: r.oldPasswordCopiesRemain ? 'warn' : 'info', text: `${t('passwordChanged')}${r.oldPasswordCopiesRemain ? ` ${t('oldCopiesRemain', { n: r.oldPasswordCopiesRemain })}` : ''}` });
      props.onPasswordChanged();
    } catch (e) {
      setMsg({ kind: 'error', text: errorText(e, t) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen">
      <h1>{t('settingsTitle')}</h1>
      <p className="screen-subtitle">{t('settingsIntro')}</p>
      <div className="card appearance-card">
        <h2>{t('themeTitle')}</h2>
        <p className="muted">{t('themeHint')}</p>
        <ThemePicker value={props.prefs.theme} onChange={(value) => props.setPref('theme', value)} />
      </div>
      <div className="card stack">
        <label className="field">
          {t('lockAfter')}
          <select value={props.prefs.lockIntervalMs} onChange={(e) => props.setPref('lockIntervalMs', Number(e.target.value))}>
            {LOCK_INTERVALS_MS.map((ms) => (
              <option key={ms} value={ms}>
                {ms < 60_000 ? t('seconds', { n: ms / 1000 }) : t('minutes', { n: ms / 60_000 })}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t('language')}
          <select value={props.prefs.language} onChange={(e) => props.setPref('language', e.target.value)}>
            <option value="auto">{t('languageAuto')}</option>
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </label>
        <p className="muted">{t('historyPolicy')}</p>
        <p className="muted">{offline ? t('offlineReady') : t('offlineNotReady')}</p>
      </div>
      <BiometricSettings disabled={busy} />
      <h2>{t('changePassword')}</h2>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void change();
        }}
      >
        <PasswordInput label={t('currentPassword')} value={cur} onChange={setCur} autoComplete="current-password" name="current" />
        <PasswordInput label={t('newPassword')} value={next} onChange={setNext} autoComplete="new-password" name="next" />
        <PasswordInput label={t('repeatPassword')} value={repeat} onChange={setRepeat} autoComplete="new-password" name="repeat" />
        <button type="submit" disabled={!cur || !next || busy}>
          {t('changePassword')}
        </button>
        {busy && <Busy label={t('working')} />}
        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      </form>
      <h2>{t('aboutTitle')}</h2>
      <p>{t('version', { v: __APP_VERSION__ })}</p>
      <p>{t('recoveryText')}</p>
    </section>
  );
}
