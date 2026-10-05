import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '../i18n.ts';
import type { Preferences } from '../protocol.ts';
import { Icon, type IconName } from './icons.tsx';

const choices = [
  { value: 'color', label: 'themeColor', icon: 'sparkles' },
  { value: 'light', label: 'themeLight', icon: 'sun' },
  { value: 'dark', label: 'themeDark', icon: 'moon' }
] as const;

export function ThemePicker(props: { value: Preferences['theme']; onChange: (v: Preferences['theme']) => void }) {
  const t = useT();
  const id = useId();
  return <fieldset className="theme-picker">
    <legend className="sr-only">{t('theme')}</legend>
    <div className="theme-choices">
      {choices.map((c) => <label key={c.value} className={`theme-choice ${props.value === c.value ? 'selected' : ''}`}>
        <input className="sr-only" type="radio" name={id} value={c.value} checked={props.value === c.value} onChange={() => props.onChange(c.value)} />
        <span className={`theme-preview preview-${c.value}`} aria-hidden="true"><span /><span /><span /></span>
        <span className="theme-label"><Icon name={c.icon} />{t(c.label)}</span>
      </label>)}
    </div>
    <label className="theme-system check">
      <input type="checkbox" checked={props.value === 'auto'} onChange={(e) => props.onChange(e.target.checked ? 'auto' : 'color')} />{t('themeAuto')}
    </label>
  </fieldset>;
}

export function ThemeMenu(props: { value: Preferences['theme']; onChange: (v: Preferences['theme']) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const icon: IconName = props.value === 'dark' ? 'moon' : props.value === 'light' ? 'sun' : 'palette';
  return <div className="theme-menu" ref={ref}>
    <button ref={button} type="button" className="secondary icon-button" aria-label={t('theme')} title={t('theme')} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><Icon name={icon} /></button>
    {open && <div className="theme-popover" id={id}>
      <h2>{t('theme')}</h2>
      <ThemePicker value={props.value} onChange={props.onChange} />
    </div>}
  </div>;
}
