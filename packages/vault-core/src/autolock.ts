/**
 * Lock policy (SECURITY_AND_FORMAT.md section 4).
 *
 * Inactivity locks after the chosen interval (30 s, 1, 2, 5, 10, 30 or 60
 * minutes, 6, 12 or 24 hours; default 2 minutes; no "never"). Switching apps does not lock by itself (a
 * documented deviation, see docs/RELEASE_EVIDENCE.md): time spent hidden
 * counts as inactivity, and the app calls `check` when it becomes visible
 * again, so a suspended background timer cannot keep a vault open past the
 * interval.
 */

export const LOCK_INTERVALS_MS = [30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000, 3_600_000, 21_600_000, 43_200_000, 86_400_000] as const;
export type LockIntervalMs = (typeof LOCK_INTERVALS_MS)[number];
export const DEFAULT_LOCK_INTERVAL_MS: LockIntervalMs = 120_000;

export function isLockInterval(value: unknown): value is LockIntervalMs {
  return typeof value === 'number' && (LOCK_INTERVALS_MS as readonly number[]).includes(value);
}

export interface AutoLockClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const systemClock: AutoLockClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>)
};

export class AutoLock {
  private readonly onLock: () => void;
  private readonly clock: AutoLockClock;
  private interval: LockIntervalMs;
  private lastActivity = 0;
  private handle: unknown = null;
  private armed = false;

  constructor(onLock: () => void, interval: LockIntervalMs = DEFAULT_LOCK_INTERVAL_MS, clock: AutoLockClock = systemClock) {
    if (!isLockInterval(interval)) throw new RangeError('lock interval');
    this.onLock = onLock;
    this.interval = interval;
    this.clock = clock;
  }

  /** Start counting after an unlock. */
  arm(): void {
    this.armed = true;
    this.touch();
  }

  /** Record user activity. */
  touch(): void {
    if (!this.armed) return;
    this.lastActivity = this.clock.now();
    this.schedule(this.interval);
  }

  setInterval(interval: LockIntervalMs): void {
    if (!isLockInterval(interval)) throw new RangeError('lock interval');
    this.interval = interval;
    if (this.armed) this.touch();
  }

  /**
   * Check on foreground/operation boundaries: locks if the interval passed
   * even when the timer never fired (throttled or suspended page).
   */
  check(): boolean {
    if (this.armed && this.clock.now() - this.lastActivity >= this.interval) {
      this.lockNow();
      return true;
    }
    return false;
  }

  lockNow(): void {
    const wasArmed = this.armed;
    this.disarm();
    if (wasArmed) this.onLock();
  }

  disarm(): void {
    this.armed = false;
    if (this.handle !== null) this.clock.clearTimeout(this.handle);
    this.handle = null;
  }

  private schedule(ms: number): void {
    if (this.handle !== null) this.clock.clearTimeout(this.handle);
    this.handle = this.clock.setTimeout(() => {
      this.handle = null;
      const idle = this.clock.now() - this.lastActivity;
      if (idle >= this.interval) this.lockNow();
      else this.schedule(this.interval - idle);
    }, ms);
  }
}
