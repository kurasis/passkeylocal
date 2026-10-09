import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SafeMenuAction { label: string; run: () => void; disabled?: boolean; danger?: boolean }
export function SafeMenu({ x, y, title, actions, close }: {
  x: number; y: number; title: string; actions: SafeMenuAction[]; close: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const bounds = menu.current?.getBoundingClientRect();
    if (bounds) setPosition({ left: Math.max(8, Math.min(x, innerWidth - bounds.width - 8)), top: Math.max(8, Math.min(y, innerHeight - bounds.height - 8)) });
    menu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [x, y]);
  useEffect(() => {
    const dismiss = (event: Event) => { if (!menu.current?.contains(event.target as Node)) close(); };
    const blur = () => close();
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("blur", blur);
    window.addEventListener("resize", blur);
    return () => { document.removeEventListener("pointerdown", dismiss); window.removeEventListener("blur", blur); window.removeEventListener("resize", blur); };
  }, [close]);
  return createPortal(<div ref={menu} className="file-safe-context" role="menu" aria-label={title} style={position} onKeyDown={(event) => {
    if (["Escape", "Tab"].includes(event.key)) { event.preventDefault(); close(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  }}>
    <p className="file-safe-context-name">{title}</p>
    {actions.map((action) => <button type="button" role="menuitem" key={action.label} className={action.danger ? "file-safe-menu-danger" : ""} disabled={action.disabled} onClick={() => { close(); action.run(); }}>{action.label}</button>)}
  </div>, document.body);
}
