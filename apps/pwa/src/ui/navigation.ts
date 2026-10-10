/** Only public section identifiers enter URLs/history. Private routes stay in RAM. */
export type Section = { module: 'passwords' | 'files'; tab: 'vault' | 'favorites' | 'backups' | 'settings' };
const tabs = ['vault', 'favorites', 'backups', 'settings'] as const;
export function sectionFromUrl(url: string): Section {
  const hash = new URL(url).hash;
  const match = /^#\/(passwords|files)\/(vault|favorites|backups|settings)$/.exec(hash);
  return match ? { module: match[1] as Section['module'], tab: match[2] as Section['tab'] } : { module: 'passwords', tab: 'vault' };
}
export function sectionHref(section: Section): string {
  if (!['passwords', 'files'].includes(section.module) || !tabs.includes(section.tab)) throw new Error('Invalid public section');
  return `#/${section.module}/${section.tab}`;
}
export class Navigation<T> {
  private routes = new Map<string, T>();
  private position = 0;
  private prefix = crypto.randomUUID();
  private returning = false;
  private current!: T;
  private section!: Section;
  private apply: (route: T) => void;
  private confirm: () => boolean;
  constructor(apply: (route: T) => void, confirm: () => boolean, initial: T, section: Section) {
    this.apply = apply;
    this.confirm = confirm;
    this.replace(initial, section);
  }
  private remember(route: T, section: Section, replace: boolean) {
    const key = crypto.randomUUID();
    this.routes.set(key, route);
    this.current = route;
    this.section = section;
    // Bound memory without putting private routes in persistent storage.
    if (this.routes.size > 256) this.routes.delete(this.routes.keys().next().value!);
    // No entry IDs, file metadata, search text or draft values in serialized state.
    const state = { navigation: this.prefix, key, position: this.position };
    if (replace) window.history.replaceState(state, '', sectionHref(section));
    else window.history.pushState(state, '', sectionHref(section));
  }
  push(route: T, section: Section) {
    if (!this.confirm()) return false;
    this.position++;
    this.remember(route, section, false);
    this.apply(route);
    return true;
  }
  replace(route: T, section: Section) {
    this.remember(route, section, true);
  }
  reset(route: T, section: Section) {
    this.routes.clear();
    this.prefix = crypto.randomUUID();
    this.position = 0;
    this.replace(route, section);
  }
  pop(event: PopStateEvent, fallback: T) {
    if (this.returning) { this.returning = false; return; }
    const state = event.state as { navigation?: string; key?: string; position?: number } | null;
    const known = state?.navigation === this.prefix && Number.isInteger(state.position);
    if (!this.confirm()) {
      if (known && state!.position !== this.position) {
        this.returning = true;
        window.history.go(this.position - state!.position!);
      } else {
        this.replace(this.current, this.section);
      }
      return;
    }
    const route = known && state?.key && this.routes.has(state.key) ? this.routes.get(state.key)! : fallback;
    if (known) {
      this.position = state!.position!;
      this.current = route;
      this.section = sectionFromUrl(window.location.href);
    } else {
      this.reset(route, sectionFromUrl(window.location.href));
    }
    this.apply(route);
  }
}
