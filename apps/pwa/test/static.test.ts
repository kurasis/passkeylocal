import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('source rules (SECURITY_AND_FORMAT.md 4 and 5)', () => {
  const all = files(SRC).map((f) => [f, readFileSync(f, 'utf8')] as const);

  it('renders vault content as text only', () => {
    for (const [f, s] of all) expect(s, f).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write/);
  });

  it('never persists plaintext in Web Storage or URLs, never uses Math.random', () => {
    for (const [f, s] of all) {
      expect(s, f).not.toMatch(/localStorage|sessionStorage|location\.hash\s*=/);
      // The one navigation boundary serializes only allowlisted public sections
      // and random history keys. Its privacy/lock behavior is tested separately.
      if (f !== join(SRC, 'ui', 'navigation.ts')) expect(s, f).not.toMatch(/history\.(push|replace)State/);
      expect(s, f).not.toMatch(/Math\.random/);
    }
  });

  it('makes no network requests and loads no remote code', () => {
    for (const [f, s] of all) {
      if (f.endsWith('service-worker.js')) continue; // same-origin asset cache only
      expect(s, f).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|https?:\/\/(?!example\.test)/);
    }
  });

  it('does not read the clipboard', () => {
    for (const [f, s] of all) expect(s, f).not.toMatch(/clipboard\.read/);
  });
});
