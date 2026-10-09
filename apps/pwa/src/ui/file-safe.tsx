/** Windows-only file-safe workspace. Original bytes never enter this component. */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLang, useT } from "../i18n.ts";
import type { HelloMode, HelloVaultStatus } from '../hello-vault-protocol.ts';
import type {
  FileSafeApi,
  SafeChange,
  SafeFile,
  SafePage,
  SafeQuery,
  SafeStatus,
  SafeImportItem,
} from "../file-safe-protocol.ts";
import { Banner } from "./common.tsx";
import { Icon } from "./icons.tsx";

const words = {
  en: {
    title: "File Safe",
    subtitle: "An independent encrypted home for your files",
    independent:
      "This safe has its own password and lock. Unlocking the password vault does not unlock it.",
    password: "File-safe master password",
    repeat: "Repeat password",
    create: "Create file safe",
    unlock: "Unlock file safe",
    lock: "Lock file safe",
    hello: "Unlock file safe with Windows Hello",
    helloTitle: "Windows Hello for File Safe",
    helloExplain: "Connect this safe separately after confirming its master password. Windows verifies your fingerprint, face or PIN. Password changes and restoring a backup disable the connection.",
    helloEnable: "Connect file safe to Windows Hello",
    helloPassword: "Confirm file-safe master password",
    preview:
      "Preview is unavailable in this build. You can store files or explicitly export a copy.",
    files: "Files",
    favorites: "Favorites",
    trash: "Recycle bin",
    import: "Copy files into safe",
    importFolder: "Copy folder into safe",
    originals:
      "Import copies files. The originals stay in their original location.",
    search: "Search names, tags and notes",
    name: "Name",
    modified: "Modified",
    size: "Size",
    folder: "New folder",
    folderName: "Folder name",
    previous: "Previous",
    next: "Next",
    empty: "No files here",
    tags: "Tags (comma separated)",
    notes: "Notes",
    favorite: "Favorite",
    save: "Save details",
    move: "Move to folder",
    history: "Version history",
    restoreVersion: "Make current",
    current: "Current",
    replace: "Replace with a new version",
    export: "Export unencrypted copy",
    exportExplain: "The exported copy remains unencrypted outside the safe.",
    exportAck: "I understand that this creates an unencrypted copy.",
    delete: "Move to recycle bin",
    recover: "Restore from recycle bin",
    permanent: "Permanently remove selected files",
    permanentExplain:
      "Remove these files from the current safe? Older encrypted snapshots and backups may still contain them.",
    removeAck: "I understand that this cannot be undone in the current safe.",
    cancel: "Cancel operation",
    working: "Working…",
    saved: "Verified and saved",
    exported: "Unencrypted copy exported",
    backedUp: "Encrypted copy written and read back",
    backup: "Encrypted backups",
    manual: "Save encrypted copy",
    configure: "Choose automatic backup folder",
    retention: "Managed copies to keep",
    backupNote:
      "A complete copy includes current files, retained versions and the recycle bin. Manual copies are never pruned automatically.",
    backupUnavailable:
      "Choose an external backup folder. A local save is not an external backup.",
    copyVerified: "Ciphertext copy verified",
    pending: "Latest snapshot awaiting copy",
    copying: "Copying pinned snapshot",
    backupFailed:
      "Backup or retention needs attention; local files remain saved.",
    ready: "Automatic backups configured",
    recoverTitle: "Recover an encrypted file-safe backup",
    recoveryPassword: "Backup master password",
    verify: "Choose and fully verify a backup",
    replaceSafe: "Replace current safe from backup",
    replaceAck:
      "I understand that this replaces the current safe. Its old encrypted generation is preserved locally.",
    verified: "All referenced content verified",
    restored: "Safe restored. Unlock it with the backup password.",
    rotate: "Change file-safe password",
    oldPassword: "Current file-safe password",
    newPassword: "New file-safe password",
    rotationExplain:
      "Current access changes to the new password. Older snapshots and backups can still require the old password.",
    interval: "Lock file safe after inactivity",
    mismatched: "Passwords do not match.",
    error: "The operation failed. No unverified file is reported as saved.",
    cancelled:
      "Operation cancelled. Files already verified and saved remain in the safe.",
    conflict:
      "The safe changed. Lock it and unlock again before repeating the action.",
    busy: "Another file operation is running.",
    failedPassword: "Wrong password or damaged encrypted data.",
    retained: "Retained content bytes",
    select: "Select",
    details: "File details",
    close: "Close details",
    status: "Backup status",
    unavailable: "Unavailable",
    failed: "Failed",
    skipped: "Skipped",
    imported: "Verified imports",
    page: "Page",
    fullFolder:
      "Only the first 200 child folders are displayed. Use a smaller folder layout.",
  },
  ru: {
    title: "Файловый сейф",
    subtitle: "Отдельное зашифрованное хранилище файлов",
    independent:
      "У сейфа свой пароль и блокировка. Вход в хранилище паролей не открывает файловый сейф.",
    password: "Мастер-пароль файлового сейфа",
    repeat: "Повторите пароль",
    create: "Создать файловый сейф",
    unlock: "Открыть файловый сейф",
    lock: "Заблокировать файловый сейф",
    hello: "Открыть файловый сейф через Windows Hello",
    helloTitle: "Windows Hello для файлового сейфа",
    helloExplain: "Подключите этот сейф отдельно, подтвердив его мастер-пароль. Windows проверяет отпечаток, лицо или PIN. Смена пароля и восстановление резервной копии отключают привязку.",
    helloEnable: "Подключить файловый сейф к Windows Hello",
    helloPassword: "Подтвердите мастер-пароль файлового сейфа",
    preview:
      "Предпросмотр недоступен в этой сборке. Можно хранить файлы или явно экспортировать копию.",
    files: "Файлы",
    favorites: "Избранное",
    trash: "Корзина",
    import: "Скопировать файлы в сейф",
    importFolder: "Скопировать папку в сейф",
    originals: "Импорт создаёт копии. Оригиналы остаются на прежнем месте.",
    search: "Поиск по именам, тегам и заметкам",
    name: "Имя",
    modified: "Изменён",
    size: "Размер",
    folder: "Новая папка",
    folderName: "Имя папки",
    previous: "Назад",
    next: "Далее",
    empty: "Здесь нет файлов",
    tags: "Теги через запятую",
    notes: "Заметки",
    favorite: "Избранное",
    save: "Сохранить сведения",
    move: "Переместить в папку",
    history: "История версий",
    restoreVersion: "Сделать текущей",
    current: "Текущая",
    replace: "Заменить новой версией",
    export: "Экспортировать незашифрованную копию",
    exportExplain:
      "Экспортированная копия останется незашифрованной вне сейфа.",
    exportAck: "Я понимаю, что создаётся незашифрованная копия.",
    delete: "Переместить в корзину",
    recover: "Вернуть из корзины",
    permanent: "Навсегда удалить выбранные файлы",
    permanentExplain:
      "Удалить файлы из текущего сейфа? Старые зашифрованные снимки и резервные копии могут по-прежнему содержать их.",
    removeAck: "Я понимаю, что это нельзя отменить в текущем сейфе.",
    cancel: "Отменить операцию",
    working: "Выполняется…",
    saved: "Проверено и сохранено",
    exported: "Незашифрованная копия экспортирована",
    backedUp: "Зашифрованная копия записана и проверена чтением",
    backup: "Зашифрованные резервные копии",
    manual: "Сохранить зашифрованную копию",
    configure: "Выбрать папку автоматических копий",
    retention: "Хранить управляемых копий",
    backupNote:
      "Полная копия включает текущие файлы, сохранённые версии и корзину. Ручные копии автоматически не удаляются.",
    backupUnavailable:
      "Выберите внешнюю папку резервных копий. Локальное сохранение не заменяет внешнюю копию.",
    copyVerified: "Копия шифротекста проверена",
    pending: "Последний снимок ожидает копирования",
    copying: "Копируется зафиксированный снимок",
    backupFailed:
      "Нужно проверить резервное копирование или удаление старых копий; локальные файлы сохранены.",
    ready: "Автоматические копии настроены",
    recoverTitle: "Восстановить сейф из зашифрованной копии",
    recoveryPassword: "Мастер-пароль резервной копии",
    verify: "Выбрать и полностью проверить копию",
    replaceSafe: "Заменить текущий сейф из копии",
    replaceAck:
      "Я понимаю, что текущий сейф будет заменён. Его прежнее зашифрованное состояние сохраняется локально.",
    verified: "Всё содержимое копии проверено",
    restored: "Сейф восстановлен. Откройте его паролем резервной копии.",
    rotate: "Изменить пароль файлового сейфа",
    oldPassword: "Текущий пароль файлового сейфа",
    newPassword: "Новый пароль файлового сейфа",
    rotationExplain:
      "Текущий доступ перейдёт на новый пароль. Старым снимкам и резервным копиям может по-прежнему требоваться прежний пароль.",
    interval: "Блокировать файловый сейф после бездействия",
    mismatched: "Пароли не совпадают.",
    error:
      "Операция не выполнена. Непроверенные файлы не отмечаются как сохранённые.",
    cancelled:
      "Операция отменена. Уже проверенные и сохранённые файлы остаются в сейфе.",
    conflict:
      "Сейф изменился. Заблокируйте его и откройте снова перед повторным действием.",
    busy: "Уже выполняется другая операция с файлами.",
    failedPassword: "Неверный пароль или повреждённые зашифрованные данные.",
    retained: "Байтов сохранённого содержимого",
    select: "Выбрать",
    details: "Сведения о файле",
    close: "Закрыть сведения",
    status: "Статус копии",
    unavailable: "Недоступно",
    failed: "Ошибок",
    skipped: "Пропущено",
    imported: "Проверенных импортов",
    page: "Страница",
    fullFolder:
      "Показаны первые 200 вложенных папок. Используйте менее крупные папки.",
  },
};
export function FileSafe({ api }: { api: FileSafeApi }) {
  const lang = useLang();
  const t = useT();
  const helloModeId = useId();
  const helloPasswordId = useId();
  const [hello, setHello] = useState<HelloVaultStatus | null>(null);
  const [helloMode, setHelloMode] = useState<HelloMode>('session');
  const [helloPassword, setHelloPassword] = useState('');
  const languageRef = useRef(lang);
  languageRef.current = lang;
  const w = words[lang];
  const [status, setStatus] = useState<SafeStatus | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [page, setPage] = useState<SafePage | null>(null);
  const [query, setQuery] = useState<SafeQuery>({
    folder_id: null,
    mode: "files",
    search: "",
    sort: "name",
    offset: 0,
    folder_offset: 0,
    limit: 100,
  });
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [candidate, setCandidate] = useState<string | null>(null);
  const [backupPassword, setBackupPassword] = useState("");
  const [replaceAck, setReplaceAck] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [admissionReady, setAdmissionReady] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [removeAck, setRemoveAck] = useState(false);
  const [retention, setRetention] = useState(10);
  const [results, setResults] = useState<SafeImportItem[]>([]);
  const [resultsOffset, setResultsOffset] = useState(0);
  const pageRequest = useRef(0);
  const pageQueue = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);
  const live = useRef(true);
  const tokenRef = useRef<string | null>(null);
  const redact = useCallback(() => {
    generation.current++;
    pageQueue.current = Promise.resolve();
    // The old status cannot authorize a new password after native revocation.
    setAdmissionReady(false);
    tokenRef.current = null;
    setToken(null);
    setPage(null);
    setSelected([]);
    setDetail(null);
    setMessage("");
    setPassword("");
    setRepeat("");
    setBackupPassword("");
    setCandidate(null);
    setOldPassword("");
    setNewPassword("");
    setHelloPassword('');
    setHello(null);
    setFolderName("");
    setReplaceAck(false);
    setRemoveAck(false);
    setResults([]);
    setResultsOffset(0);
    setQuery({
      folder_id: null,
      mode: "files",
      search: "",
      sort: "name",
      offset: 0,
      folder_offset: 0,
      limit: 100,
    });
    setStatus((s) =>
      s
        ? {
            ...s,
            unlocked: false,
            token: null,
            progress: { stage: "", done: 0, total: 0 },
          }
        : s,
    );
  }, []);
  const fail = (error: unknown) => {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code === "LOCKED") {
      redact();
      return;
    }
    setMessage(
      code === 'HELLO_CANCELLED' ? t('helloVaultCancelled')
      : code === 'HELLO_UNAVAILABLE' ? t('helloVaultUnavailable')
      : code === 'HELLO_CLEANUP_REQUIRED' ? t('helloVaultCleanup')
      : code === 'HELLO_EXPIRED' ? t('helloVaultExpired')
      : code === "CANCELLED" || code === 'STALE'
        ? w.cancelled
        : code === "CONFLICT"
          ? w.conflict
          : code === "BUSY"
            ? w.busy
            : code === "AUTH_FAILED"
              ? w.failedPassword
              : w.error,
    );
  };
  const refreshStatus = useCallback(async () => {
    const epoch = generation.current;
    try {
      const result = await api.status();
      if (!live.current || epoch !== generation.current) return;
      if (!result.unlocked && tokenRef.current) {
        redact();
      }
      tokenRef.current = result.token;
      setToken(result.token);
      setStatus(result);
      setAdmissionReady(true);
      try {
        const hello = await api.hello({ operation: 'status' });
        if (live.current && epoch === generation.current) setHello(hello.status);
      } catch { /* Existing lock/status remains authoritative during a busy OS operation. */ }
    } catch {
      if (live.current && epoch === generation.current) {
        redact();
        setStatus(null);
        setMessage(
          languageRef.current === "ru"
            ? "Файловый сейф недоступен. Хранилище паролей доступно."
            : "File safe unavailable. Password vault remains available.",
        );
      }
    }
  }, [api, redact]);
  const reload = useCallback(async () => {
    const request = ++pageRequest.current;
    const epoch = generation.current;
    const current = tokenRef.current;
    if (!current) return;
    const isCurrent = () =>
      live.current &&
      epoch === generation.current &&
      current === tokenRef.current &&
      request === pageRequest.current;
    // Admission refresh and the token effect may both request a page. Native
    // reads share one store mutex; serialize them and skip superseded queries.
    // Lock resets the queue, so a new session never waits for an old response.
    const previous = pageQueue.current;
    const pending = (async () => {
      await previous;
      if (!isCurrent()) return;
      try {
        const result = await api.page(current, query);
        if (isCurrent()) setPage(result);
      } catch (error) {
        if (isCurrent()) fail(error);
      }
    })();
    pageQueue.current = pending;
    await pending;
  }, [api, query, lang, redact]);
  useEffect(() => {
    live.current = true;
    const stop = api.subscribeLock(redact);
    void refreshStatus();
    const interval = setInterval(() => void refreshStatus(), 1000);
    return () => {
      live.current = false;
      generation.current++;
      pageQueue.current = Promise.resolve();
      tokenRef.current = null;
      clearInterval(interval);
      stop();
    };
  }, [api, redact, refreshStatus]);
  useEffect(() => {
    void reload();
  }, [token, reload]);
  const run = async (action: () => Promise<unknown>, success = w.saved) => {
    if (working) return;
    const epoch = generation.current;
    setWorking(true);
    setMessage("");
    try {
      const result = await action();
      if (
        live.current &&
        epoch === generation.current &&
        result !== false &&
        result !== null
      )
        setMessage(typeof result === "string" ? result : success);
    } catch (error) {
      if (live.current && epoch === generation.current) fail(error);
    } finally {
      if (live.current) {
        setWorking(false);
        if (epoch === generation.current) {
          await refreshStatus();
          await reload();
        }
      }
    }
  };
  const change = (value: SafeChange) =>
    token && page && run(() => api.change(token, page.snapshot_id, value));
  const activity = () => {
    if (tokenRef.current) api.activity(tokenRef.current);
  };
  const busy = working || Boolean(status?.busy);
  const current = page?.files.find((f) => f.id === detail);
  const importFiles = (recursive: boolean, replace: string | null = null) => {
    if (!token || !page) return;
    void run(async () => {
      const epoch = generation.current;
      const result = await api.import(
        token,
        page.snapshot_id,
        page.folder_id,
        recursive,
        replace,
      );
      if (epoch === generation.current && result) {
        setResults(result.items);
        setResultsOffset(0);
      }
      return result
        ? `${w.imported}: ${result.imported}; ${w.failed}: ${result.failed}; ${w.skipped}: ${result.skipped}${result.cancelled ? `. ${w.cancelled}` : ""}`
        : null;
    });
  };
  const loadResults = async (offset: number) => {
    const epoch = generation.current;
    const items = await api.importResults(token!, offset);
    if (
      live.current &&
      epoch === generation.current &&
      token === tokenRef.current &&
      items.length
    ) {
      setResults(items);
      setResultsOffset(offset);
    }
    return false;
  };
  const restoreBackup = async (pw: string, ticket: string) => {
    if (working) return;
    setWorking(true);
    setMessage("");
    try {
      const result = await api.recover(pw, ticket, true);
      // Only a generic successful restore status may cross its own lock event.
      // No filename, count, candidate or previous token is restored to the UI.
      if (
        live.current &&
        !tokenRef.current &&
        result?.status === "restored_locked"
      )
        setMessage(w.restored);
    } catch (error) {
      if (live.current) fail(error);
    } finally {
      if (live.current) {
        setWorking(false);
        await refreshStatus();
      }
    }
  };
  const recovery = (
    <details className="card stack">
      <summary>{w.recoverTitle}</summary>
      <label>
        {w.recoveryPassword}
        <input
          type="password"
          autoComplete="off"
          value={backupPassword}
          onChange={(e) => setBackupPassword(e.target.value)}
          maxLength={1024}
        />
      </label>
      <button
        type="button"
        className="secondary"
        disabled={busy || !backupPassword}
        onClick={() => {
          const pw = backupPassword;
          setBackupPassword("");
          void run(async () => {
            const epoch = generation.current;
            const r = await api.recover(pw, null, false);
            if (r?.candidate && live.current && epoch === generation.current)
              setCandidate(r.candidate);
            return r ? `${w.verified}: ${r.files} / ${r.versions}` : null;
          });
        }}
      >
        {w.verify}
      </button>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={replaceAck}
          onChange={(e) => setReplaceAck(e.target.checked)}
        />
        {w.replaceAck}
      </label>
      <button
        type="button"
        className="danger"
        disabled={busy || !backupPassword || !replaceAck || !candidate}
        onClick={() => {
          const pw = backupPassword;
          setBackupPassword("");
          if (candidate) void restoreBackup(pw, candidate);
        }}
      >
        {w.replaceSafe}
      </button>
    </details>
  );
  if (!token)
    return (
      <section className="stack file-safe-access">
        <div className="page-heading">
          <span className="eyebrow">Windows</span>
          <h1>{w.title}</h1>
          <p>{w.independent}</p>
        </div>
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!status?.exists && password !== repeat) {
              setMessage(w.mismatched);
              return;
            }
            if (!status || !admissionReady) return;
            const pw = password;
            const expectedGeneration = status.generation;
            setPassword("");
            setRepeat("");
            void run(async () => {
              await api.access(pw, !status.exists, expectedGeneration);
            });
          }}
        >
          <label>
            {w.password}
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={1024}
              required
              disabled={busy}
            />
          </label>
          {status && !status.exists && (
            <label>
              {w.repeat}
              <input
                type="password"
                autoComplete="off"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                maxLength={1024}
                required
                disabled={busy}
              />
            </label>
          )}
          <button
            type="submit"
            disabled={busy || !status || !admissionReady || !password}
          >
            {busy ? w.working : status?.exists ? w.unlock : w.create}
          </button>
          {hello?.state === 'enabled' && <button type="button" className="secondary"
            disabled={busy || !status || !admissionReady}
            onClick={() => status && void run(() => api.hello({ operation: 'unlock', expected_generation: status.generation }), w.ready)}>
              {w.hello}
          </button>}
          {hello?.state === 'cleanup-required' && <p className="muted">{t('helloVaultExpired')}</p>}
        </form>
        {recovery}
        {message && <Banner kind="info">{message}</Banner>}
      </section>
    );
  return (
    <section
      className="stack file-safe-workspace"
      onPointerDown={activity}
      onKeyDown={activity}
    >
      <div className="page-heading file-safe-heading">
        <div>
          <span className="eyebrow">{w.subtitle}</span>
          <h1>{w.title}</h1>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            redact();
            void api.lock();
          }}
        >
          <Icon name="lock" />
          {w.lock}
        </button>
      </div>
      <p className="muted">{w.originals}</p>
      <div className="file-safe-toolbar">
        <button
          type="button"
          disabled={busy || !page}
          onClick={() => importFiles(false)}
        >
          {w.import}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || !page}
          onClick={() => importFiles(true)}
        >
          {w.importFolder}
        </button>
        {busy && (
          <button
            type="button"
            className="secondary"
            onClick={() => void api.cancel(token)}
          >
            {w.cancel}
          </button>
        )}
      </div>
      {busy && (
        <Banner kind="info">
          <span role="status">
            {w.working}{" "}
            {status?.progress.total
              ? `${status.progress.done} / ${status.progress.total}`
              : ""}
          </span>
        </Banner>
      )}
      {message && <Banner kind="info">{message}</Banner>}
      <div className="file-safe-layout">
        <aside className="card stack file-safe-sidebar" aria-label={w.folder}>
          {(["files", "favorites", "trash"] as const).map((mode) => (
            <button
              type="button"
              className="secondary"
              key={mode}
              aria-current={query.mode === mode ? "page" : undefined}
              onClick={() => {
                setSelected([]);
                setDetail(null);
                setQuery((q) => ({ ...q, mode, offset: 0 }));
              }}
            >
              {w[mode]}
            </button>
          ))}
          {page?.ancestors.map((f, i) => (
            <button
              type="button"
              className="secondary"
              key={f.id}
              onClick={() => {
                setSelected([]);
                setDetail(null);
                setQuery((q) => ({
                  ...q,
                  folder_id: f.id,
                  folder_offset: 0,
                  offset: 0,
                  mode: "files",
                }));
              }}
            >
              {i === 0 ? w.files : f.name}
            </button>
          ))}
          {page?.folders.map((f) => (
            <button
              type="button"
              className="secondary"
              key={f.id}
              onClick={() => {
                setSelected([]);
                setDetail(null);
                setQuery((q) => ({
                  ...q,
                  folder_id: f.id,
                  folder_offset: 0,
                  offset: 0,
                  mode: "files",
                }));
              }}
            >
              ▸ {f.name}
            </button>
          ))}
          {page && page.folders_total > 200 && (
            <div className="input-row">
              <button
                type="button"
                className="secondary"
                disabled={!query.folder_offset}
                onClick={() =>
                  setQuery((q) => ({
                    ...q,
                    folder_offset: Math.max(0, q.folder_offset - 200),
                  }))
                }
              >
                {w.previous}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={query.folder_offset + 200 >= page.folders_total}
                onClick={() =>
                  setQuery((q) => ({
                    ...q,
                    folder_offset: q.folder_offset + 200,
                  }))
                }
              >
                {w.next}
              </button>
            </div>
          )}
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!page) return;
              const name = folderName;
              setFolderName("");
              void change({ kind: "folder", parent_id: page.folder_id, name });
            }}
          >
            <label>
              {w.folderName}
              <input
                maxLength={255}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="secondary"
              disabled={busy || !folderName || !page}
            >
              {w.folder}
            </button>
          </form>
        </aside>
        <div className="stack file-safe-content">
          <div className="file-safe-filters">
            <label>
              {w.search}
              <input
                type="search"
                value={query.search}
                maxLength={256}
                onChange={(e) => {
                  setSelected([]);
                  setQuery((q) => ({
                    ...q,
                    search: e.target.value,
                    offset: 0,
                  }));
                }}
              />
            </label>
            <label>
              {w.modified}
              <select
                value={query.sort}
                onChange={(e) =>
                  setQuery((q) => ({
                    ...q,
                    sort: e.target.value as SafeQuery["sort"],
                    offset: 0,
                  }))
                }
              >
                <option value="name">{w.name}</option>
                <option value="modified">{w.modified}</option>
                <option value="size">{w.size}</option>
              </select>
            </label>
          </div>
          {page && (
            <>
              <VirtualFiles
                files={page.files}
                selected={selected}
                select={(id, checked) =>
                  setSelected((ids) =>
                    checked ? [...ids, id] : ids.filter((x) => x !== id),
                  )
                }
                detail={setDetail}
                labels={{ select: w.select, empty: w.empty }}
              />
              <div className="input-row">
                <button
                  type="button"
                  className="secondary"
                  disabled={!query.offset || busy}
                  onClick={() => {
                    setSelected([]);
                    setQuery((q) => ({
                      ...q,
                      offset: Math.max(0, q.offset - q.limit),
                    }));
                  }}
                >
                  {w.previous}
                </button>
                <span>
                  {w.page} {Math.floor(query.offset / query.limit) + 1} ·{" "}
                  {page.total}
                </span>
                <button
                  type="button"
                  className="secondary"
                  disabled={query.offset + query.limit >= page.total || busy}
                  onClick={() => {
                    setSelected([]);
                    setQuery((q) => ({ ...q, offset: q.offset + q.limit }));
                  }}
                >
                  {w.next}
                </button>
              </div>
              <p className="muted">
                {w.retained}: {page.storage_bytes}
              </p>
            </>
          )}
          {selected.length > 0 && (
            <div className="card stack">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void change({
                    kind: "trash",
                    file_ids: selected,
                    deleted: query.mode !== "trash",
                    permanent: false,
                    confirm: false,
                  })
                }
              >
                {query.mode === "trash" ? w.recover : w.delete} (
                {selected.length})
              </button>
              {query.mode === "trash" && (
                <>
                  <p>{w.permanentExplain}</p>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={removeAck}
                      onChange={(e) => setRemoveAck(e.target.checked)}
                    />
                    {w.removeAck}
                  </label>
                  <button
                    type="button"
                    className="danger"
                    disabled={busy || !removeAck}
                    onClick={() => {
                      void change({
                        kind: "trash",
                        file_ids: selected,
                        deleted: true,
                        permanent: true,
                        confirm: true,
                      });
                      setSelected([]);
                      setRemoveAck(false);
                    }}
                  >
                    {w.permanent}
                  </button>
                </>
              )}
            </div>
          )}
          {current && (
            <FileDetails
              key={current.id}
              file={current}
              folders={[...(page?.ancestors ?? []), ...(page?.folders ?? [])]}
              busy={busy}
              labels={w}
              change={change}
              close={() => setDetail(null)}
              replace={() => importFiles(false, current.id)}
              exportVersion={(version) =>
                void run(
                  () => api.export(token, current.id, version, true),
                  w.exported,
                )
              }
            />
          )}
        </div>
      </div>
      {results.length > 0 && (
        <details className="card stack">
          <summary>{w.imported}</summary>
          {results.map((r) => (
            <p key={r.index}>
              {r.name}: {r.status === "verified_and_saved" ? w.saved : w.failed}
            </p>
          ))}
          <div className="input-row">
            <button
              type="button"
              className="secondary"
              disabled={busy || !resultsOffset}
              onClick={() =>
                void run(() => loadResults(Math.max(0, resultsOffset - 200)))
              }
            >
              {w.previous}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy || results.length < 200}
              onClick={() => void run(() => loadResults(resultsOffset + 200))}
            >
              {w.next}
            </button>
          </div>
        </details>
      )}
      <details className="card stack">
        <summary>{w.backup}</summary>
        <p>{w.backupNote}</p>
        <p role="status">
          {status?.backup.status === "ciphertext_copy_verified" &&
          page?.snapshot_id === status.backup.completed_snapshot
            ? w.copyVerified
            : status?.backup.status === "pending"
              ? w.pending
              : status?.backup.status === "copying"
                ? w.copying
                : ["failed", "retention_blocked"].includes(
                      status?.backup.status ?? "",
                    )
                  ? w.backupFailed
                  : status?.backup.configured
                    ? w.ready
                    : w.backupUnavailable}
        </p>
        <label>
          {w.retention}
          <input
            type="number"
            min={1}
            max={100}
            value={retention}
            onChange={(e) => setRetention(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={busy || retention < 1 || retention > 100}
          onClick={() =>
            void run(() => api.backup(token, true, retention), w.ready)
          }
        >
          {w.configure}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || !status?.backup.configured}
          onClick={() => void run(() => api.retryBackup(token), w.pending)}
        >
          {w.pending}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(() => api.backup(token, false, retention), w.backedUp)
          }
        >
          {w.manual}
        </button>
      </details>
      {recovery}
      <details className="card stack" data-testid="file-safe-hello">
        <summary>{w.helloTitle}</summary>
        <p>{w.helloExplain}</p>
        <p className="muted">{t('helloVaultExperimental')}</p>
        {hello && <p role="status">{t(hello.state === 'enabled' ? 'helloVaultEnabled' : hello.state === 'cleanup-required' ? 'helloVaultCleanup' : 'helloVaultOff')}</p>}
        {hello?.state === 'enabled' && <p>{t(`helloVaultMode_${hello.mode ?? 'session'}`)}{hello.expiresAt ? ` · ${new Date(hello.expiresAt).toLocaleString()}` : ''}</p>}
        {hello?.state === 'off' && <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          const pw = helloPassword;
          setHelloPassword('');
          void run(() => api.hello({ operation: 'enroll', token, password: pw, mode: helloMode }), w.ready);
        }}>
          <label htmlFor={helloModeId}>{t('helloVaultMode')}</label>
          <select id={helloModeId} value={helloMode} disabled={busy} onChange={(e) => setHelloMode(e.target.value as HelloMode)}>
            {(['session', 'remember6', 'remember12', 'remember24'] as const).map((mode) => <option key={mode} value={mode}>{t(`helloVaultMode_${mode}`)}</option>)}
          </select>
          <label htmlFor={helloPasswordId}>{w.helloPassword}</label>
          <input id={helloPasswordId} name="file-safe-hello-password" type="password" autoComplete="current-password" maxLength={1024} value={helloPassword} disabled={busy} onChange={(e) => setHelloPassword(e.target.value)} />
          <button type="submit" disabled={busy || !helloPassword}>{w.helloEnable}</button>
        </form>}
        {hello && hello.state !== 'off' && <button type="button" className="secondary" disabled={busy || !status || !admissionReady}
          onClick={() => status && void run(() => api.hello({ operation: 'revoke', expected_generation: status.generation }), w.ready)}>{t('helloVaultDisable')}</button>}
      </details>
      <details className="card stack">
        <summary>{w.rotate}</summary>
        <p>{w.rotationExplain}</p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!page) return;
            const current = oldPassword;
            const next = newPassword;
            setOldPassword("");
            setNewPassword("");
            void run(() => api.rotate(token, page.snapshot_id, current, next));
          }}
        >
          <label>
            {w.oldPassword}
            <input
              type="password"
              autoComplete="off"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              maxLength={1024}
            />
          </label>
          <label>
            {w.newPassword}
            <input
              type="password"
              autoComplete="off"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              maxLength={1024}
            />
          </label>
          <button type="submit" disabled={busy || !oldPassword || !newPassword}>
            {w.rotate}
          </button>
        </form>
      </details>
      <label>
        {w.interval}
        <select
          value={status?.interval_ms ?? 120000}
          onChange={(e) =>
            void run(() => api.interval(token, Number(e.target.value)))
          }
        >
          <option value={30000}>30 s</option>
          <option value={60000}>1 min</option>
          <option value={120000}>2 min</option>
          <option value={300000}>5 min</option>
        </select>
      </label>
    </section>
  );
}

function VirtualFiles({
  files,
  selected,
  select,
  detail,
  labels,
}: {
  files: SafeFile[];
  selected: string[];
  select: (id: string, checked: boolean) => void;
  detail: (id: string) => void;
  labels: { select: string; empty: string };
}) {
  const [scroll, setScroll] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
    setScroll(0);
  }, [files]);
  const height = 76;
  const start = Math.max(0, Math.floor(scroll / height) - 2);
  const end = Math.min(files.length, start + 12);
  if (!files.length) return <div className="card">{labels.empty}</div>;
  return (
    <div
      className="card file-safe-viewport"
      ref={viewport}
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
      role="list"
      aria-label="Files"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const target = e.currentTarget;
        target.scrollTop =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? files.length * height
              : target.scrollTop + (e.key === "ArrowDown" ? height : -height);
      }}
    >
      <div style={{ height: files.length * height, position: "relative" }}>
        {files.slice(start, end).map((file, index) => (
          <div
            className="file-safe-row"
            role="listitem"
            key={file.id}
            style={{
              position: "absolute",
              height,
              top: (start + index) * height,
              left: 0,
              right: 0,
            }}
          >
            <input
              type="checkbox"
              aria-label={`${labels.select}: ${file.name}`}
              checked={selected.includes(file.id)}
              onChange={(e) => select(file.id, e.target.checked)}
            />
            <button
              type="button"
              className="file-safe-file secondary"
              onClick={() => detail(file.id)}
            >
              <strong>
                {file.favorite ? "★ " : ""}
                {file.name}
              </strong>
              <span>
                {file.size} B · {file.tags.join(", ")}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileDetails({
  file,
  folders,
  busy,
  labels: w,
  change,
  close,
  replace,
  exportVersion,
}: {
  file: SafeFile;
  folders: SafePage["folders"];
  busy: boolean;
  labels: typeof words.en;
  change: (value: SafeChange) => unknown;
  close: () => void;
  replace: () => void;
  exportVersion: (version: string | null) => void;
}) {
  const [name, setName] = useState(file.name);
  const [tags, setTags] = useState(file.tags.join(", "));
  const [notes, setNotes] = useState(file.notes);
  const [favorite, setFavorite] = useState(file.favorite);
  const [folder, setFolder] = useState(file.folder_id);
  const [ack, setAck] = useState(false);
  return (
    <section className="card stack" aria-label={w.details}>
      <div className="input-row">
        <h2>{file.name}</h2>
        <button type="button" className="secondary" onClick={close}>
          {w.close}
        </button>
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          change({
            kind: "edit",
            edit: {
              file_id: file.id,
              folder_id: folder,
              name,
              tags: tags
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              notes,
              favorite,
            },
          });
        }}
      >
        <label>
          {w.name}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            required
          />
        </label>
        <label>
          {w.move}
          <select value={folder} onChange={(e) => setFolder(e.target.value)}>
            {folders
              .filter((f, i, all) => all.findIndex((x) => x.id === f.id) === i)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name || w.files}
                </option>
              ))}
          </select>
        </label>
        <label>
          {w.tags}
          <input
            value={tags}
            maxLength={4096}
            onChange={(e) => setTags(e.target.value)}
          />
        </label>
        <label>
          {w.notes}
          <textarea
            value={notes}
            maxLength={4096}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => setFavorite(e.target.checked)}
          />
          {w.favorite}
        </label>
        <button type="submit" disabled={busy}>
          {w.save}
        </button>
      </form>
      <Banner kind="info">{w.preview}</Banner>
      <button
        type="button"
        className="secondary"
        disabled={busy || file.deleted}
        onClick={replace}
      >
        {w.replace}
      </button>
      <p>{w.exportExplain}</p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        {w.exportAck}
      </label>
      <button
        type="button"
        disabled={busy || !ack}
        onClick={() => exportVersion(null)}
      >
        {w.export}
      </button>
      <h3>{w.history}</h3>
      {file.versions.map((v) => (
        <div className="file-safe-version" key={v.id}>
          <span>
            {v.created_at} · {v.size} B {v.current && `· ${w.current}`}
          </span>
          <button
            type="button"
            className="secondary"
            disabled={busy || v.current}
            onClick={() =>
              change({
                kind: "restore_version",
                file_id: file.id,
                version_id: v.id,
              })
            }
          >
            {w.restoreVersion}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy || !ack}
            onClick={() => exportVersion(v.id)}
          >
            {w.export}
          </button>
        </div>
      ))}
    </section>
  );
}
