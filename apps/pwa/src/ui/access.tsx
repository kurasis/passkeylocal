/** Screens shown before a vault is unlocked, plus the onboarding backup drill. */

import { useEffect, useState } from 'react';
import type { BlobInfo } from '@passkey-local/vault-core';
import { useT } from '../i18n.ts';
import { ExportControl, RestoreControl, VerifyControl } from './backup-tools.tsx';
import { BiometricUnlock } from './biometric.tsx';
import { Icon } from './icons.tsx';
import { Banner, Busy, PasswordInput, errorCode, errorText, handOffFile, newPasswordProblem, useApp, useFormatDate } from './common.tsx';

export function Welcome() {
  const t = useT();
  const [mode, setMode] = useState<'intro' | 'create' | 'restore'>('intro');
  const { refresh } = useApp();
  if (mode === 'create') return <CreateVault onCancel={() => setMode('intro')} />;
  if (mode === 'restore')
    return (
      <section className="screen narrow">
        <h1>{t('restoreTitle')}</h1>
        <RestoreControl replacing={false} onDone={refresh} />
        <button type="button" className="link" onClick={() => setMode('intro')}>
          {t('back')}
        </button>
      </section>
    );
  return (
    <section className="screen narrow welcome">
      <div className="welcome-hero">
        <span className="auth-icon"><Icon name="vault" /></span>
        <p className="eyebrow">{t('welcomeEyebrow')}</p>
        <h1>{t('welcomeTitle')}</h1>
        <p className="welcome-lead">{t('welcomeLead')}</p>
      </div>
      <div className="card stack">
      <ul className="facts">
        <li><span className="fact-icon"><Icon name="shield" /></span><span>{t('welcomeLocal')}</span></li>
        <li><span className="fact-icon"><Icon name="key" /></span><span>{t('welcomePassword')}</span></li>
        <li><span className="fact-icon"><Icon name="backup" /></span><span>{t('welcomeBackup')}</span></li>
      </ul>
      <div className="stack">
        <button type="button" onClick={() => setMode('create')}>
          <Icon name="plus" />{t('createVault')}
        </button>
        <button type="button" className="secondary" onClick={() => setMode('restore')}>
          {t('restoreVault')}
        </button>
      </div>
      </div>
    </section>
  );
}

function CreateVault(props: { onCancel: () => void }) {
  const t = useT();
  const { client, refresh } = useApp();
  const [pw, setPw] = useState('');
  const [repeat, setRepeat] = useState('');
  const [suggestion, setSuggestion] = useState<{ value: string; bits: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const problem = newPasswordProblem(pw, repeat, t);
  const spaces = pw !== pw.trim();

  const submit = async () => {
    setTouched(true);
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      await client.call('create', { password: pw });
      setPw('');
      setRepeat('');
      refresh();
    } catch (e) {
      setError(errorText(e, t));
      setBusy(false);
    }
  };

  return (
    <section className="screen narrow auth-screen">
      <span className="auth-icon"><Icon name="key" /></span>
      <h1>{t('createTitle')}</h1>
      <p>{t('createExplain')}</p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <PasswordInput label={t('masterPassword')} value={pw} onChange={setPw} autoComplete="new-password" autoFocus name="new-password" />
        <PasswordInput label={t('repeatPassword')} value={repeat} onChange={setRepeat} autoComplete="new-password" name="repeat-password" />
        {spaces && <Banner kind="warn">{t('warnSpaces')}</Banner>}
        {touched && problem && <Banner kind="error">{problem}</Banner>}
        <button
          type="button"
          className="secondary"
          onClick={async () => setSuggestion(await client.call('generatePassphrase'))}
        >
          {t('suggestPassphrase')}
        </button>
        {suggestion && (
          <div className="card">
            <p className="muted">{t('suggestedPassphrase', { bits: suggestion.bits })}</p>
            <p className="mono secret-text">{suggestion.value}</p>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setPw(suggestion.value);
                setRepeat('');
              }}
            >
              {t('useSuggestion')}
            </button>
          </div>
        )}
        <button type="submit" disabled={busy}>
          {t('createVault')}
        </button>
        {busy && <Busy label={t('creating')} />}
        {error && <Banner kind="error">{error}</Banner>}
        <button type="button" className="link" onClick={props.onCancel}>
          {t('back')}
        </button>
      </form>
    </section>
  );
}

export function Unlock() {
  const t = useT();
  const { client, refresh } = useApp();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const epoch = client.epoch;
    try {
      const value = pw;
      setPw('');
      await client.call('unlock', { password: value });
      if (client.epoch === epoch) refresh();
    } catch (e) {
      if (client.epoch !== epoch) return;
      const code = errorCode(e);
      setError(code === 'CORRUPT' ? t('err_CORRUPT') : errorText(e, t));
      if (code === 'CORRUPT') refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen narrow auth-screen">
      <span className="auth-icon"><Icon name="lock" /></span>
      <p className="eyebrow">{t('unlockEyebrow')}</p>
      <h1>{t('unlockTitle')}</h1>
      <p className="muted">{t('unlockHint')}</p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <PasswordInput label={t('masterPassword')} value={pw} onChange={setPw} autoComplete="current-password" autoFocus name="password" />
        <button type="submit" disabled={!pw || busy}>
          {t('unlock')}
        </button>
        <BiometricUnlock busy={busy} setBusy={setBusy} onError={setError} />
        {busy && <Busy label={t('unlocking')} />}
        {error && <Banner kind="error">{error}</Banner>}
      </form>
      <button type="button" className="link" onClick={() => setVerify((v) => !v)}>
        {t('verifyFromLocked')}
      </button>
      {verify && <VerifyControl />}
    </section>
  );
}

export function DamagedVault() {
  const t = useT();
  const fmt = useFormatDate();
  const { client, refresh } = useApp();
  const [snapshots, setSnapshots] = useState<BlobInfo[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromFile, setFromFile] = useState(false);

  useEffect(() => {
    client.call('snapshots').then(setSnapshots, (e: unknown) => setError(errorText(e, t)));
  }, [client, t]);

  const restore = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const value = pw;
      setPw('');
      await client.call('restoreSnapshot', { blobId: chosen, password: value });
      refresh();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  const exportRaw = async (blobId: string) => {
    try {
      const f = await client.call('rawSnapshot', { blobId });
      await handOffFile(f);
    } catch (e) {
      setError(errorText(e, t));
    }
  };

  return (
    <section className="screen narrow">
      <h1>{t('damagedTitle')}</h1>
      <p>{t('damagedExplain')}</p>
      <ul className="list">
        {snapshots.map((s) => (
          <li key={s.id} className="card stack">
            <span>{t('snapshotLabel', { date: fmt(s.committedAt), gen: s.generation })}</span>
            {s.isHead ? (
              <button type="button" className="secondary" onClick={() => exportRaw(s.id)}>
                {t('exportDamaged')}
              </button>
            ) : (
              <button type="button" className="secondary" onClick={() => setChosen(s.id)} aria-pressed={chosen === s.id}>
                {t('restoreThisVersion')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {chosen && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void restore();
          }}
        >
          <PasswordInput label={t('masterPassword')} value={pw} onChange={setPw} autoComplete="current-password" name="password" />
          <button type="submit" disabled={!pw || busy}>
            {t('restoreThisVersion')}
          </button>
        </form>
      )}
      {busy && <Busy label={t('working')} />}
      {error && <Banner kind="error">{error}</Banner>}
      <button type="button" className="link" onClick={() => setFromFile((v) => !v)}>
        {t('restoreFromFile')}
      </button>
      {fromFile && <RestoreControl replacing onDone={refresh} />}
    </section>
  );
}

/** Required before real data: export the empty vault and verify the saved file. */
export function BackupDrill(props: { onDone: () => void }) {
  const t = useT();
  const { client } = useApp();
  const [verified, setVerified] = useState(false);
  return (
    <section className="screen narrow">
      <h1>{t('drillTitle')}</h1>
      <p>{t('drillExplain')}</p>
      <h2>{t('drillStep1')}</h2>
      <ExportControl />
      <h2>{t('drillStep2')}</h2>
      <VerifyControl
        onVerified={(r) => {
          if (r.matchesCurrentHead) {
            setVerified(true);
            client.call('setPreference', { key: 'onboardingBackupVerified', value: true }).catch(() => {});
          }
        }}
      />
      {verified && (
        <>
          <Banner kind="info">{t('drillDone')}</Banner>
          <button type="button" onClick={props.onDone}>
            {t('continue')}
          </button>
        </>
      )}
    </section>
  );
}
