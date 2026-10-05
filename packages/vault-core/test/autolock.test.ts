import { describe, expect, it } from 'vitest';
import { AutoLock, DEFAULT_LOCK_INTERVAL_MS, LOCK_INTERVALS_MS, isLockInterval, type AutoLockClock } from '../src/index.ts';

function fakeClock() {
  let t = 0;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: AutoLockClock = {
    now: () => t,
    setTimeout: (fn, ms) => {
      const id = next++;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number)
  };
  const advance = (ms: number, fireTimers = true) => {
    t += ms;
    if (!fireTimers) return;
    for (const [id, tm] of [...timers]) {
      if (tm.at <= t) {
        timers.delete(id);
        tm.fn();
      }
    }
  };
  return { clock, advance };
}

describe('AutoLock', () => {
  it('offers 30 s up to 60 minutes with 2 minutes default and no "never"', () => {
    expect([...LOCK_INTERVALS_MS]).toEqual([30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000, 3_600_000]);
    expect(DEFAULT_LOCK_INTERVAL_MS).toBe(120_000);
    expect(isLockInterval(0)).toBe(false);
    expect(isLockInterval(Infinity)).toBe(false);
    expect(() => new AutoLock(() => {}, 0 as never)).toThrow(RangeError);
  });

  it('locks after inactivity and activity postpones it', () => {
    const { clock, advance } = fakeClock();
    let locks = 0;
    const al = new AutoLock(() => locks++, 60_000, clock);
    al.arm();
    advance(50_000);
    al.touch();
    advance(50_000);
    expect(locks).toBe(0);
    advance(10_000);
    expect(locks).toBe(1);
    advance(600_000);
    expect(locks).toBe(1); // disarmed after locking
  });

  it('check() locks on foreground return even if the timer never fired', () => {
    const { clock, advance } = fakeClock();
    let locks = 0;
    const al = new AutoLock(() => locks++, 30_000, clock);
    al.arm();
    advance(45_000, false); // suspended page: timers did not run
    expect(al.check()).toBe(true);
    expect(locks).toBe(1);
  });

  it('lockNow is immediate and idempotent', () => {
    const { clock } = fakeClock();
    let locks = 0;
    const al = new AutoLock(() => locks++, 120_000, clock);
    al.arm();
    al.lockNow();
    al.lockNow();
    expect(locks).toBe(1);
  });
});
