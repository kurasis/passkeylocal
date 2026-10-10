import { afterEach, describe, expect, it, vi } from 'vitest';
import { Navigation, sectionFromUrl, sectionHref } from '../src/ui/navigation.ts';

afterEach(() => vi.unstubAllGlobals());
describe('public navigation boundary and ephemeral private history', () => {
  it('accepts only known public sections and never serializes a private route', () => {
    const pushState = vi.fn(), replaceState = vi.fn();
    vi.stubGlobal('window', { history: { pushState, replaceState, go: vi.fn() } });
    const initial = { title: 'SYNTHETIC-PRIVATE-TITLE', password: 'SYNTHETIC-PRIVATE-PASSWORD', id: 'PRIVATE-ID' };
    const apply = vi.fn();
    const section = { module: 'passwords', tab: 'vault' } as const;
    const nav = new Navigation(apply, () => true, initial, section);
    nav.push(initial, { ...section, tab: 'settings' });
    const serialized = JSON.stringify([...replaceState.mock.calls, ...pushState.mock.calls]);
    for (const value of Object.values(initial)) expect(serialized).not.toContain(value);
    expect(pushState.mock.calls[0]![2]).toBe('#/passwords/settings');
    expect(sectionFromUrl('https://example.test/#/passwords/settings')).toEqual({ module: 'passwords', tab: 'settings' });
    expect(sectionFromUrl('https://example.test/#/passwords/PRIVATE-ID')).toEqual(section);
    expect(() => sectionHref({ ...section, tab: 'PRIVATE-ID' } as any)).toThrow('Invalid public section');
  });
  it('restores a private route only before reset and reverses a rejected Back once', () => {
    const history = { pushState: vi.fn(), replaceState: vi.fn(), go: vi.fn() };
    vi.stubGlobal('window', { history, location: { href: 'https://example.test/#/passwords/vault' } });
    const apply = vi.fn(), confirm = vi.fn(() => true);
    const section = { module: 'passwords', tab: 'vault' } as const;
    const nav = new Navigation<string>(apply, confirm, 'list', section);
    const first = history.replaceState.mock.calls[0]![0];
    nav.push('private-detail', section);
    const second = history.pushState.mock.calls[0]![0];
    confirm.mockReturnValue(false);
    nav.pop({ state: first } as PopStateEvent, 'fallback');
    expect(history.go).toHaveBeenCalledWith(1);
    const attempts = confirm.mock.calls.length;
    nav.pop({ state: second } as PopStateEvent, 'fallback');
    expect(confirm).toHaveBeenCalledTimes(attempts);
    confirm.mockReturnValue(true);
    nav.pop({ state: second } as PopStateEvent, 'fallback');
    expect(apply).toHaveBeenLastCalledWith('private-detail');
    nav.reset('locked-list', section);
    nav.pop({ state: second } as PopStateEvent, 'fallback');
    expect(apply).toHaveBeenLastCalledWith('fallback');
  });
});
