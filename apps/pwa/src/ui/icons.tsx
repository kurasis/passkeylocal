/** Small, bundled line icons; no external assets, fonts or requests. */
export type IconName = 'vault' | 'key' | 'lock' | 'shield' | 'star' | 'backup' | 'settings' | 'palette' | 'sun' | 'moon' | 'sparkles' | 'search' | 'sliders' | 'plus' | 'chevron' | 'check' | 'folder' | 'file' | 'arrowLeft' | 'arrowRight' | 'arrowUp' | 'trash';
const paths: Record<IconName, string> = {
  vault: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM3 8h2m-2 8h2m7-8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 0v3m0 2v3m-4-4h3m2 0h3',
  key: 'M14 3a7 7 0 0 0-6.5 9.6L3 17v4h4v-3h3l2.4-2.5A7 7 0 1 0 14 3Zm3 4h.01',
  lock: 'M6 10h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Zm2 0V6a4 4 0 0 1 8 0v4m-4 5v3',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  star: 'm12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-2.9-5.6 2.9 1-6.2L2.9 9.6l6.3-.9L12 3Z',
  backup: 'M12 3v12m-4-4 4 4 4-4M5 14H3v7h18v-7h-2',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-5h4l1 3 3 1 3 2v6l-3 2-3 1-1 3h-4l-1-3-3-1-3-2V9l3-2 3-1 1-3Z',
  palette: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7c-.8-.5-.4-1.8.6-1.8H17a4 4 0 0 0 4-4A9 9 0 0 0 12 3ZM7 10h.01M10 6h.01M15 6h.01M18 10h.01',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon: 'M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z',
  sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5',
  sliders: 'M3 6h4m4 0h10M3 12h10m4 0h4M3 18h4m4 0h10M7 3v6m6 0v6M7 15v6',
  plus: 'M12 5v14M5 12h14',
  chevron: 'm9 6 6 6-6 6',
  folder: 'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8m-8 4h6',
  arrowLeft: 'm12 5-7 7 7 7M5 12h14',
  arrowRight: 'm12 5 7 7-7 7M5 12h14',
  arrowUp: 'm5 12 7-7 7 7M12 5v14',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  check: 'm5 12 4 4L19 6'
};

export function Icon(props: { name: IconName; className?: string }) {
  return <svg className={`icon ${props.className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[props.name]} /></svg>;
}
