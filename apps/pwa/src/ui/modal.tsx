import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Native modality makes the background inert and traps/restores keyboard focus. */
export function Modal({ children, close, label, labelledBy, className = '', busy = false, initialFocus }: {
  children: ReactNode; close: () => void; label?: string; labelledBy?: string;
  className?: string; busy?: boolean; initialFocus?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    const target = node.querySelector<HTMLElement>(initialFocus ?? '[data-dialog-cancel]') ?? node.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)');
    (target ?? node).focus();
    return () => {
      node.close();
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLElement>('#main-content')?.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} tabIndex={-1} className={`modal-dialog card stack ${className}`}
    aria-label={label} aria-labelledby={labelledBy} onCancel={(event) => { event.preventDefault(); if (!busy) close(); }}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
        .filter(node => node.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last!.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) { event.preventDefault(); first.focus(); }
    }}>
    {children}
  </dialog>, document.body);
}
