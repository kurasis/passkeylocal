/**
 * App shell and lock lifecycle (SECURITY_AND_FORMAT.md section 4):
 *  - only the AutoLock interval from Settings locks; switching apps does not
 *    (user decision 2026-10-05, a documented deviation from section 4). Time
 *    spent hidden counts as inactivity and is checked on every return;
 *  - while hidden the UI is visually redacted (best effort for the app switcher);
 *  - reloads start locked;
 *  - no plaintext in URLs, storage, or document titles.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BackupStatus } from '@passkey-local/vault-core';
import { AutoLock, DEFAULT_LOCK_INTERVAL_MS, isLockInterval } from '@passkey-local/vault-core/autolock';
import { I18nContext, deviceLanguage, translator, useT } from '../i18n.ts';
import type { LifecycleState, Overview, Preferences } from '../protocol.ts';
import { VaultClient } from '../vault-client.ts';
import { BackupDrill, DamagedVault, Unlock, Welcome } from './access.tsx';
import { AppContext, Banner, errorText, handOffFile, useApp, type AppApi } from './common.tsx';
import { BackupStatusBanner, BackupsTab, SettingsTab } from './tabs.tsx';
import { VaultScreens, type VaultView } from './vault.tsx';
import { useServiceWorkerUpdate } from './sw-update.ts';

type Tab = 'vault' | 'favorites' | 'backups' | 'settings';

const DEFAULT_PREFS: Preferences = { lockIntervalMs: DEFAULT_LOCK_INTERVAL_MS, language: 'auto', theme: 'auto', onboardingBackupVerified: false };

export function App() {
  const client = useMemo(() => new VaultClient(), []);
  const [phase, setPhase] = useState<LifecycleState | 'loading'>('loading');
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [persistence, setPersistence] = useState('unavailable');
  const [unhealthy, setUnhealthy] = useState(false);
  const [tab, setTab] = useState<Tab>('vault');
  const [view, setView] = useState<VaultView>({ name: 'list' });
  const [notice, setNotice] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const update = useServiceWorkerUpdate();

  const lang = prefs.language === 'auto' ? deviceLanguage() : prefs.language;
  const t = useMemo(() => translator(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = 'PassKey Local';
  }, [lang]);
  useEffect(() => {
    if (prefs.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = prefs.theme;
  }, [prefs.theme]);

  const loadUnlocked = useCallback(async () => {
    const epoch = client.epoch;
    const [o, s] = await Promise.all([client.call('overview'), client.call('backupStatus')]);
    if (client.epoch !== epoch) return;
    setOverview(o);
    setStatus(s);
  }, [client]);

  const refresh = useCallback(async () => {
    const epoch = client.epoch;
    try {
      const st = await client.call('state');
      const p = await client.call('getPreferences');
      if (client.epoch !== epoch) return;
      setPrefs(p);
      setPersistence(st.persistence);
      setUnhealthy(st.storageUnhealthy);
      if (st.state === 'unlocked') await loadUnlocked();
      if (client.epoch !== epoch) return;
      setPhase(st.state);
    } catch (e) {
      if (client.epoch === epoch) setFatal(errorText(e, t));
    }
  }, [client, loadUnlocked, t]);

  const lockNow = useCallback(() => {
    client.lock();
    // Unmount every sensitive view and drop derived data.
    setOverview(null);
    setStatus(null);
    setView({ name: 'list' });
    setTab('vault');
    setNotice(null);
    setPhase('loading');
    void refresh();
  }, [client, refresh]);

  const autoLock = useRef<AutoLock | null>(null);
  useEffect(() => {
    autoLock.current = new AutoLock(() => lockNow(), isLockInterval(prefs.lockIntervalMs) ? prefs.lockIntervalMs : DEFAULT_LOCK_INTERVAL_MS);
    return () => autoLock.current?.disarm();
  }, [lockNow, prefs.lockIntervalMs]);
  useEffect(() => {
    if (phase === 'unlocked') autoLock.current?.arm();
    else autoLock.current?.disarm();
  }, [phase, prefs.lockIntervalMs]);

  useEffect(() => {
    const redact = (on: boolean) => document.documentElement.classList.toggle('redacted', on);
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        redact(true);
      } else {
        autoLock.current?.check();
        redact(false);
      }
    };
    const onPageHide = () => redact(true);
    const onPageShow = () => {
      autoLock.current?.check();
      redact(false);
    };
    const onActivity = () => autoLock.current?.touch();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('focus', () => autoLock.current?.check());
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [lockNow]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(id);
  }, [notice]);

  const api: AppApi = useMemo(() => ({ client, notify: setNotice, refresh: () => void refresh(), lockNow }), [client, refresh, lockNow]);

  const setPref = (key: keyof Preferences, value: unknown) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    client.call('setPreference', { key, value }).catch((e: unknown) => setNotice(errorText(e, t)));
  };

  const reload = async () => {
    try {
      await loadUnlocked();
    } catch (e) {
      setNotice(errorText(e, t));
    }
  };

  let body: React.ReactNode;
  if (fatal) body = <Banner kind="error">{fatal}</Banner>;
  else if (phase === 'loading') body = null;
  else if (phase === 'empty') body = <Welcome />;
  else if (phase === 'locked') body = <Unlock />;
  else if (phase === 'head-unreadable') body = <DamagedVault />;
  else if (!overview) body = null;
  else if (!prefs.onboardingBackupVerified)
    body = (
      <BackupDrill
        onDone={() => {
          setPrefs((p) => ({ ...p, onboardingBackupVerified: true }));
          void reload();
        }}
      />
    );
  else {
    body = (
      <>
        <UnsavedBanner overview={overview} reload={reload} />
        {tab !== 'backups' && <BackupStatusBanner status={status} />}
        {(tab === 'vault' || tab === 'favorites') && (
          <VaultScreens overview={overview} favoritesOnly={tab === 'favorites'} view={view} go={setView} reload={reload} />
        )}
        {tab === 'backups' && <BackupsTab status={status} persistence={persistence} storageUnhealthy={unhealthy} onChanged={() => void reload()} />}
        {tab === 'settings' && <SettingsTab prefs={prefs} setPref={setPref} onPasswordChanged={() => void reload()} />}
      </>
    );
  }

  const unlocked = phase === 'unlocked' && overview && prefs.onboardingBackupVerified;

  return (
    <I18nContext.Provider value={{ t, lang }}>
      <AppContext.Provider value={api}>
        <div className="app">
          <header className="topbar">
            <span className="brand">{t('appName')}</span>
            {phase === 'unlocked' && (
              <button type="button" className="secondary" onClick={lockNow}>
                {t('lock')}
              </button>
            )}
          </header>
          {update && phase !== 'unlocked' && (
            <Banner kind="info">
              {t('updateAvailable')}{' '}
              <button type="button" className="secondary" onClick={update}>
                {t('updateNow')}
              </button>
            </Banner>
          )}
          <main>{body}</main>
          {notice && (
            <div className="toast" role="status">
              {notice}
            </div>
          )}
          {unlocked && (
            <nav className="tabbar" aria-label="Main">
              {(
                [
                  ['vault', t('navVault')],
                  ['favorites', t('navFavorites')],
                  ['backups', t('navBackups')],
                  ['settings', t('navSettings')]
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={() => {
                    setTab(id);
                    setView({ name: 'list' });
                    if (id === 'backups') void reload();
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </AppContext.Provider>
    </I18nContext.Provider>
  );
}

function UnsavedBanner(props: { overview: Overview; reload: () => Promise<void> }) {
  const { client, notify } = useApp();
  const t = useT();
  const u = props.overview.unsaved;
  if (!u) return null;
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      notify(errorText(e, t));
    }
    await props.reload();
  };
  return (
    <Banner kind="error">
      <p>{u.code === 'CONFLICT' ? t('conflictBanner') : t('unsavedBanner')}</p>
      <div className="input-row">
        {u.code !== 'CONFLICT' && (
          <button type="button" onClick={() => run(() => client.call('retrySave'))}>
            {t('retry')}
          </button>
        )}
        <button type="button" className="secondary" onClick={() => run(async () => handOffFile(await client.call('unsavedForExport')))}>
          {t('exportUnsaved')}
        </button>
        <button type="button" className="secondary" onClick={() => run(() => client.call('discardChanges'))}>
          {t('discardAndReload')}
        </button>
      </div>
    </Banner>
  );
}
