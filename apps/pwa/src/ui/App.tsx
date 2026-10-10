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
import { Icon, type IconName } from './icons.tsx';
import { ThemeMenu } from './theme.tsx';
import { configureNativeClose, desktop, nativeActivity, subscribeNativeLock, fileSafe } from '@platform';
import { DesktopBackupStatus } from './desktop.tsx';
import { FileSafe } from './file-safe.tsx';
import { Modal } from './modal.tsx';
import { DraftContext, useDraftRegistry } from './drafts.tsx';
import { Navigation, sectionFromUrl, sectionHref, type Section } from './navigation.ts';

type Tab = Section['tab'];
type Route = Section & { view: VaultView };

const DEFAULT_PREFS: Preferences = { lockIntervalMs: DEFAULT_LOCK_INTERVAL_MS, language: 'auto', theme: 'color', onboardingBackupVerified: false };

export function App() {
  const client = useMemo(() => new VaultClient(), []);
  const [phase, setPhase] = useState<LifecycleState | 'loading'>('loading');
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [persistence, setPersistence] = useState('unavailable');
  const [unhealthy, setUnhealthy] = useState(false);
  const initialSection = useMemo(() => { const section = sectionFromUrl(location.href); return !fileSafe ? { ...section, module: 'passwords' as const } : section; }, []);
  const [tab, setTab] = useState<Tab>(initialSection.tab);
  const [module, setModule] = useState<'passwords' | 'files'>(initialSection.module);
  const navigation = useRef<Navigation<Route> | null>(null);
  const [view, setView] = useState<VaultView>({ name: 'list' });
  const [notice, setNotice] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [closePrompt, setClosePrompt] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeResolve = useRef<((close: boolean) => void) | null>(null);
  const draftSave = useRef<(() => Promise<boolean>) | null>(null);
  const registerDraftSave = useCallback((save: () => Promise<boolean>) => {
    draftSave.current = save;
    return () => { if (draftSave.current === save) draftSave.current = null; };
  }, []);
  const update = useServiceWorkerUpdate();

  const lang = prefs.language === 'auto' ? deviceLanguage() : prefs.language;
  const t = useMemo(() => translator(lang), [lang]);
  const drafts = useDraftRegistry(t('discardDraftConfirm'));
  const confirmNavigation = useRef(drafts.confirmLeave);
  confirmNavigation.current = drafts.confirmLeave;
  const navigate = (route: Route) => {
    if (route.module === module && route.tab === tab && JSON.stringify(route.view) === JSON.stringify(view)) return true;
    return navigation.current?.push(route, route) ?? false;
  };
  const go = (next: VaultView) => navigate({ module, tab, view: next });
  const goSection = (next: Section) => navigate({ ...next, view: { name: 'list' } });
  useEffect(() => {
    const apply = (route: Route) => { setModule(route.module); setTab(route.tab); setView(route.view); };
    navigation.current = new Navigation<Route>(apply, () => confirmNavigation.current(), { ...initialSection, view: { name: 'list' } }, initialSection);
    const pop = (event: PopStateEvent) => { const section = sectionFromUrl(location.href); navigation.current?.pop(event, { ...section, module: fileSafe ? section.module : 'passwords', view: { name: 'list' } }); };
    window.addEventListener('popstate', pop);
    return () => { window.removeEventListener('popstate', pop); navigation.current = null; };
  }, [initialSection]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = 'PassKey Local';
  }, [lang]);
  useEffect(() => {
    if (prefs.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = prefs.theme;
    const sync = () => document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    sync();
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
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
    draftSave.current = null;
    closeResolve.current?.(false);
    closeResolve.current = null;
    setClosePrompt(false);
    client.lock();
    // Unmount every sensitive view and drop derived data.
    setOverview(null);
    setStatus(null);
    setView({ name: 'list' });
    setTab('vault');
    navigation.current?.reset({ module, tab: 'vault', view: { name: 'list' } }, { module, tab: 'vault' });
    setNotice(null);
    setPhase('loading');
    void refresh();
  }, [client, refresh, module]);

  useEffect(() => subscribeNativeLock(lockNow), [lockNow]);
  useEffect(() => configureNativeClose(async () => {
    if (phase !== 'unlocked' && !drafts.hasUnsaved()) return true;
    const epoch = client.epoch;
    const o = phase === 'unlocked' ? await client.call('overview') : null;
    if (client.epoch !== epoch) return false;
    if (drafts.hasUnsaved() || o?.unsaved) return new Promise<boolean>((resolve) => {
      closeResolve.current = resolve;
      setClosePrompt(true);
    });
    lockNow();
    return true;
  }), [phase, view, client, t, lockNow, drafts.hasUnsaved]);

  useEffect(() => {
    if (!desktop) return;
    const shortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); if (module === 'files') void fileSafe?.lock(); else lockNow(); }
      if (module === 'files') {
        if (event.ctrlKey && event.key.toLowerCase() === 'f') { event.preventDefault(); document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(); }
        return;
      }
      if (phase !== 'unlocked') return;
      if (event.ctrlKey && event.key.toLowerCase() === 'f') {
        event.preventDefault(); if (!goSection({ module: 'passwords', tab: 'vault' })) return;
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus());
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'n' && !overview?.readOnly) {
        event.preventDefault(); navigate({ module: 'passwords', tab: 'vault', view: { name: 'edit', uuid: null } });
      }
      if (event.ctrlKey && event.key.toLowerCase() === 's') {
        event.preventDefault(); document.querySelector<HTMLFormElement>('main form')?.requestSubmit();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [phase, overview, lockNow, module, tab, view]);

  const autoLock = useRef<AutoLock | null>(null);
  useEffect(() => {
    autoLock.current = new AutoLock(() => lockNow(), isLockInterval(prefs.lockIntervalMs) ? prefs.lockIntervalMs : DEFAULT_LOCK_INTERVAL_MS);
    return () => autoLock.current?.disarm();
  }, [lockNow, prefs.lockIntervalMs]);
  useEffect(() => {
    if (phase === 'unlocked') autoLock.current?.arm();
    else autoLock.current?.disarm();
  }, [phase, prefs.lockIntervalMs, lockNow]);

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
    const onActivity = () => { if (module === 'passwords') { autoLock.current?.touch(); nativeActivity(); } };
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
  }, [lockNow, module]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (phase !== 'unlocked') return;
    let active = true;
    const epoch = client.epoch;
    const check = async () => {
      try {
        const next = await client.call('backupStatus');
        if (active && client.epoch === epoch) setStatus(next);
      } catch { /* Lock and the ordinary refresh own lifecycle errors. */ }
    };
    const interval = setInterval(() => void check(), 60000);
    window.addEventListener('focus', check);
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', check); };
  }, [phase, client]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(id);
  }, [notice]);

  const api: AppApi = useMemo(() => ({ client, notify: setNotice, refresh: () => void refresh(), lockNow, registerDraftSave }), [client, refresh, lockNow, registerDraftSave]);

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
        <DesktopBackupStatus />
        {tab !== 'backups' && <BackupStatusBanner status={status} />}
        {(tab === 'vault' || tab === 'favorites') && (
          <VaultScreens overview={overview} favoritesOnly={tab === 'favorites'} view={view} go={go} reload={reload} />
        )}
        {tab === 'backups' && <BackupsTab status={status} persistence={persistence} storageUnhealthy={unhealthy} onChanged={() => void reload()} />}
        {tab === 'settings' && <SettingsTab prefs={prefs} setPref={setPref} onPasswordChanged={() => void reload()} />}
      </>
    );
  }

  if (module === 'files' && fileSafe) body = <FileSafe api={fileSafe} />;
  const unlocked = module === 'passwords' && phase === 'unlocked' && overview && prefs.onboardingBackupVerified;

  return (
    <I18nContext.Provider value={{ t, lang }}>
      <DraftContext.Provider value={drafts}>
      <AppContext.Provider value={api}>
        <div className={`app ${unlocked ? 'workspace' : 'access-layout'}${desktop ? ' desktop-app' : ''}${module === 'files' ? ' file-safe-app' : ''}`}>
          <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>{t('skipToContent')}</a>
          <header className="topbar">
            <div className="brand"><span className="brand-mark"><Icon name="vault" /></span><span>{t('appName')}<small>{t('brandSubtitle')}</small></span></div>
            <div className="topbar-actions">
              {desktop && fileSafe && <div className="module-navigation" role="navigation" aria-label={lang === 'ru' ? 'Хранилища' : 'Vault modules'}>
            <a className="secondary nav-link" href={sectionHref({ module: 'passwords', tab })} aria-current={module === 'passwords' ? 'page' : undefined} onClick={(event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); goSection({ module: 'passwords', tab }); }}>{lang === 'ru' ? 'Пароли' : 'Passwords'}</a>
            <a className="secondary nav-link" href={sectionHref({ module: 'files', tab: 'vault' })} aria-current={module === 'files' ? 'page' : undefined} onClick={(event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); goSection({ module: 'files', tab: 'vault' }); }}>{lang === 'ru' ? 'Файловый сейф' : 'File Safe'}</a>
            <button type="button" className="secondary" onClick={() => { lockNow(); void fileSafe?.lockAll(); }}>{lang === 'ru' ? 'Заблокировать всё' : 'Lock all'}</button>
          </div>}
              <span className="privacy-chip"><Icon name="shield" />{t('localOnly')}</span>
              <ThemeMenu value={prefs.theme} onChange={(value) => setPref('theme', value)} />
            {module === 'passwords' && phase === 'unlocked' && (
              <button type="button" className="secondary" aria-label={t('lock')} title={t('lock')} onClick={lockNow}>
                <Icon name="lock" /><span className="lock-label">{t('lock')}</span>
              </button>
            )}
            </div>
          </header>
          {update && phase !== 'unlocked' && (
            <Banner kind="info">
              {t('updateAvailable')}{' '}
              <button type="button" className="secondary" onClick={update}>
                {t('updateNow')}
              </button>
            </Banner>
          )}

          <main id="main-content" tabIndex={-1}>{body}</main>
          {desktop && closePrompt && <Modal className="desktop-close-dialog" labelledBy="desktop-close-title" busy={closing} close={() => { closeResolve.current?.(false); closeResolve.current = null; setClosePrompt(false); }}>
            <h2 id="desktop-close-title">{t('desktopCloseTitle')}</h2><p>{t('desktopCloseExplain')}</p>
            <button type="button" disabled={closing} onClick={async () => {
              const epoch = client.epoch;
              setClosing(true);
              try {
                const o = phase === 'unlocked' ? await client.call('overview') : null;
                if (o?.unsaved) await client.call('retrySave');
                if (draftSave.current && !(await draftSave.current())) return;
                if (client.epoch !== epoch) return;
                const done = closeResolve.current; closeResolve.current = null;
                lockNow(); done?.(true);
              } catch (e) { setNotice(errorText(e, t)); }
              finally { setClosing(false); }
            }}>{t('save')}</button>
            <button type="button" className="danger" disabled={closing} onClick={() => {
              const done = closeResolve.current; closeResolve.current = null; lockNow(); done?.(true);
            }}>{t('desktopDiscardClose')}</button>
            <button type="button" className="secondary" data-dialog-cancel disabled={closing} onClick={() => {
              closeResolve.current?.(false); closeResolve.current = null; setClosePrompt(false);
            }}>{t('cancel')}</button>
          </Modal>}
          {notice && (
            <div className="toast" role="status">
              {notice}
            </div>
          )}
          {unlocked && (
            <nav className="tabbar workspace-navigation" aria-label={t('workspaceLabel')}>
              <span className="nav-heading">{t('workspaceLabel')}</span>
              {(
                [
                  ['vault', t('navVault')],
                  ['favorites', t('navFavorites')],
                  ['backups', t('navBackups')],
                  ['settings', t('navSettings')]
                ] as const
              ).map(([id, label]) => (
                <a
                  className="nav-link" href={sectionHref({ module: 'passwords', tab: id })}
                  key={id}
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    if (goSection({ module: 'passwords', tab: id }) && id === 'backups') void reload();
                  }}
                >
                  <Icon name={({ vault: 'vault', favorites: 'star', backups: 'backup', settings: 'settings' } as Record<Tab, IconName>)[id]} /><span>{label}</span>
                </a>
              ))}
              <div className="nav-note"><Icon name="shield" /><strong>{t('localOnly')}</strong><span>{t(desktop ? 'desktopPrivacy' : 'navPrivacy')}</span></div>
            </nav>
          )}
        </div>
      </AppContext.Provider>
      </DraftContext.Provider>
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
