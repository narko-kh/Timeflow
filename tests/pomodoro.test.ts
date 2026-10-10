/*
 * تست ماشین حالت Pomodoro (خالص)
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POMODORO,
  idleState,
  reset,
  skipBreak,
  startWork,
  tick,
} from '../src/shared/pomodoro';

const cfg = DEFAULT_POMODORO;
const MIN = 60_000;

describe('pomodoro', () => {
  it('قبل از پایان مرحله اتفاقی نمی‌افته', () => {
    const s = startWork(idleState(), cfg, 0);
    const r = tick(s, cfg, 25 * MIN - 1);
    expect(r.event).toBeNull();
    expect(r.state).toBe(s);
  });

  it('پایان تمرکز با تأخیر: لحظه‌ی دقیق پایان گزارش می‌شه و استراحت از همون لحظه شروع می‌شه', () => {
    const s = startWork(idleState(), cfg, 0);
    const r = tick(s, cfg, 27 * MIN); // ۲ دقیقه دیر tick شده
    expect(r.event).toEqual({ type: 'workEnded', at: 25 * MIN, nextBreak: 'shortBreak' });
    expect(r.state.phase).toBe('shortBreak');
    expect(r.state.startedAt).toBe(25 * MIN);
    expect(r.state.endsAt).toBe(30 * MIN);
    expect(r.state.completedWork).toBe(1);
  });

  it('پایان استراحت: به idle برمی‌گرده', () => {
    const s = tick(startWork(idleState(), cfg, 0), cfg, 25 * MIN).state;
    const r = tick(s, cfg, 31 * MIN);
    expect(r.event).toEqual({ type: 'breakEnded', at: 30 * MIN });
    expect(r.state.phase).toBe('idle');
    expect(r.state.completedWork).toBe(1);
  });

  it('بعد از ۴ دوره استراحت بلند میاد', () => {
    let s = idleState();
    let t = 0;
    const kinds: string[] = [];
    for (let i = 0; i < 4; i++) {
      s = startWork(s, cfg, t);
      const w = tick(s, cfg, t + cfg.workMs);
      kinds.push(w.state.phase);
      t = w.state.endsAt as number;
      s = tick(w.state, cfg, t).state; // پایان استراحت
    }
    expect(kinds).toEqual(['shortBreak', 'shortBreak', 'shortBreak', 'longBreak']);
  });

  it('طول استراحت بلند ۱۵ دقیقه‌ست', () => {
    const s = startWork(idleState(3), cfg, 0);
    const r = tick(s, cfg, cfg.workMs);
    expect(r.state.phase).toBe('longBreak');
    expect((r.state.endsAt as number) - (r.state.startedAt as number)).toBe(15 * MIN);
  });

  it('رد کردن استراحت و ریست', () => {
    const brk = tick(startWork(idleState(), cfg, 0), cfg, 25 * MIN).state;
    const skipped = skipBreak(brk);
    expect(skipped.phase).toBe('idle');
    expect(skipped.completedWork).toBe(1);
    expect(reset().completedWork).toBe(0);
  });

  it('skipBreak وسط تمرکز بی‌اثره', () => {
    const s = startWork(idleState(), cfg, 0);
    expect(skipBreak(s)).toBe(s);
  });
});
