import { useEffect, useMemo, useRef, useState } from "react";
import type { FileSafeApi, SafeFile } from "../file-safe-protocol.ts";

/** At most 24 inert text segments in the DOM; no document bytes or HTML parser. */
export function TextPreview({ api, token, snapshot, file, lang, close, lock }: {
  api: FileSafeApi; token: string; snapshot: string; file: SafeFile; lang: "en" | "ru"; close: () => void; lock: () => void;
}) {
  const words = lang === "ru" ? {
    title: "Предпросмотр TXT", close: "Закрыть предпросмотр", lock: "Заблокировать сейф", loading: "Читаем проверенный файл…", readOnly: "Только чтение · UTF-8", smaller: "Уменьшить текст", larger: "Увеличить текст", section: "Часть текста", previous: "Предыдущая часть", next: "Следующая часть",
    unavailable: "Не удалось создать изолированный предпросмотр. Файл сохранён в сейфе.", unsupported: "Нужен обычный текст в UTF-8. Другая кодировка или двоичный файл не поддерживаются.", limit: "Предпросмотр TXT доступен для файлов до 8 МиБ.", timeout: "Предпросмотр остановлен: превышено время ожидания.",
  } : {
    title: "TXT preview", close: "Close preview", lock: "Lock file safe", loading: "Reading verified file…", readOnly: "Read only · UTF-8", smaller: "Smaller text", larger: "Larger text", section: "Text section", previous: "Previous section", next: "Next section",
    unavailable: "The isolated preview could not start. The file remains stored in the safe.", unsupported: "Plain UTF-8 text is required. Other encodings and binary files are unsupported.", limit: "TXT preview supports files up to 8 MiB.", timeout: "Preview stopped: time limit exceeded.",
  };
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [font, setFont] = useState(14);
  const [scroll, setScroll] = useState(0);
  const [part, setPart] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true, started = false;
    const request_id = crypto.randomUUID().replaceAll("-", "");
    setText(null); setError(""); setScroll(0); setPart(0);
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    queueMicrotask(() => { if (!live) return; started = true;
    void api.preview({ operation: "read", token, snapshot, file: file.id, version: file.current_version_id, request_id }).then((response) => {
      if (!live) return;
      if (!response || response.request_id !== request_id || response.text.length > 8 * 1024 * 1024) { setError(words.unavailable); return; }
      setText(response.text);
    }).catch((cause: { code?: string }) => {
      if (!live) return;
      setError(cause.code === "PREVIEW_UNSUPPORTED" ? words.unsupported : cause.code === "LIMIT_EXCEEDED" ? words.limit : cause.code === "PREVIEW_TIMEOUT" ? words.timeout : words.unavailable);
    });
    });
    return () => { live = false; if (started) void api.preview({ operation: "cancel", token, request_id }).catch(() => {}); previous?.focus(); };
  }, [api, token, snapshot, file.id, file.current_version_id]);
  // Typed offsets stay bounded even for millions of empty lines. Long lines
  // split into 512-code-unit segments without splitting surrogate pairs.
  const index = useMemo(() => {
    if (text === null) return null;
    const offsets = new Uint32Array(text.length + 2);
    let count = 1, position = 0;
    while (position < text.length) {
      let end = Math.min(text.length, position + 512);
      let newline = -1;
      for (let i = position; i < end; i++) { if (text.charCodeAt(i) === 10) { newline = i; break; } }
      if (newline >= 0 && newline < end) end = newline + 1;
      else if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]!)) end++;
      offsets[count++] = end; position = end;
    }
    if (count === 1) offsets[count++] = 0;
    return { offsets, count: count - 1 };
  }, [text]);
  const height = font * 1.6;
  const start = Math.max(0, Math.floor(scroll / height) - 2);
  // Bound physical scroll height below browser CSS limits, including an 8 MiB
  // file of only newlines. Every segment remains reachable without truncation.
  const parts = Math.ceil((index?.count ?? 0) / 20000);
  const count = Math.min(20000, Math.max(0, (index?.count ?? 0) - part * 20000));
  const changePart = (value: number) => { setPart(Math.max(0, Math.min(parts - 1, value))); setScroll(0); if (viewport.current) viewport.current.scrollTop = 0; };
  return <div className="desktop-close-overlay"><section ref={dialog} className="card stack file-safe-preview" role="dialog" aria-modal="true" aria-label={words.title} onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key === "Tab") {
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input, [tabindex='0']")];
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && i <= 0 || !event.shiftKey && i === items.length - 1) { event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0]?.focus(); }
    }
  }}>
    <div className="file-safe-preview-heading"><div><h2>{file.name}</h2><p className="muted">{words.readOnly}</p></div><button type="button" className="secondary" onClick={close}>{words.close}</button></div>
    <div className="input-row"><button type="button" className="secondary" aria-label={words.smaller} disabled={font <= 12} onClick={() => setFont((v) => v - 2)}>A−</button><button type="button" className="secondary" aria-label={words.larger} disabled={font >= 24} onClick={() => setFont((v) => v + 2)}>A+</button><button type="button" className="secondary" onClick={lock}>{words.lock}</button></div>
    {text === null && !error && <p role="status">{words.loading}</p>}
    {error && <p role="alert">{error}</p>}
    {parts > 1 && <div className="input-row file-safe-text-pages"><button type="button" className="secondary" disabled={part === 0} onClick={() => changePart(part - 1)}>{words.previous}</button><label>{words.section}<input type="number" min={1} max={parts} value={part + 1} onChange={(e) => { const value = Number(e.target.value); if (Number.isInteger(value)) changePart(value - 1); }} /></label><span>/ {parts}</span><button type="button" className="secondary" disabled={part + 1 === parts} onClick={() => changePart(part + 1)}>{words.next}</button></div>}
    {index && text !== null && <div ref={viewport} className="file-safe-text" role="region" aria-label={words.title} tabIndex={0} onScroll={(e) => setScroll(e.currentTarget.scrollTop)} onKeyDown={(event) => {
      if (event.target !== event.currentTarget || !["Home", "End", "ArrowDown", "ArrowUp"].includes(event.key)) return;
      event.preventDefault(); event.currentTarget.scrollTop = event.key === "Home" ? 0 : event.key === "End" ? count * height : event.currentTarget.scrollTop + (event.key === "ArrowDown" ? height : -height);
    }} style={{ fontSize: font }}>
      <div style={{ height: count * height, minWidth: "max-content", position: "relative" }}>
        {Array.from({ length: Math.max(0, Math.min(24, count - start)) }, (_, i) => { const row = part * 20000 + start + i; return <pre key={row} style={{ position: "absolute", top: (start + i) * height, height, lineHeight: `${height}px` }}>{text.slice(index.offsets[row], index.offsets[row + 1]).replace(/\r?\n$/, "") || " "}</pre>; })}
      </div>
    </div>}
  </section></div>;
}
