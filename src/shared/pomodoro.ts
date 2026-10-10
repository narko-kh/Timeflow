/*
 * ماشین حالت Pomodoro (خالص)
 * ---------------------------
 * هیچ تایمر و Electron‌ای اینجا نیست؛ فقط «حالت فعلی + زمان» می‌گیره و حالت بعدی رو برمی‌گردونه.
 * مرحله‌ها: idle → work → shortBreak/longBreak → idle
 * نکته‌ی مهم: پایان هر مرحله با «لحظه‌ی دقیق پایان» گزارش می‌شه، نه لحظه‌ی tick؛
 * و مرحله‌ی بعد از همون لحظه‌ی پایان شروع می‌شه (تا تأخیر tick زمان رو خراب نکنه).
 */
import type { PomodoroConfig, PomodoroState } from './types';

export const DEFAULT_POMODORO: PomodoroConfig = {
  workMs: 25 * 60_000,
  shortBreakMs: 5 * 60_000,
  longBreakMs: 15 * 60_000,
  longEvery: 4,
};

export const idleState = (completedWork = 0): PomodoroState => ({
  phase: 'idle',
  startedAt: null,
  endsAt: null,
  completedWork,
});

/** رویدادی که با tick اتفاق می‌افته؛ `at` لحظه‌ی دقیق پایان مرحله‌ست */
export type PomodoroEvent =
  | { type: 'workEnded'; at: number; nextBreak: 'shortBreak' | 'longBreak' }
  | { type: 'breakEnded'; at: number };

export interface TickResult {
  state: PomodoroState;
  event: PomodoroEvent | null;
}

/** شروع یک دوره‌ی تمرکز از لحظه‌ی now (شمارنده‌ی دوره‌ها حفظ می‌شه) */
export function startWork(
  state: PomodoroState,
  cfg: PomodoroConfig,
  now: number,
): PomodoroState {
  return {
    phase: 'work',
    startedAt: now,
    endsAt: now + cfg.workMs,
    completedWork: state.completedWork,
  };
}

/**
 * جلو بردن ماشین تا لحظه‌ی now.
 * اگه مرحله تموم شده باشه، «فقط یک گذار» انجام می‌شه؛ صدا‌زننده می‌تونه تا
 * وقتی event برمی‌گرده دوباره tick کنه (مثلاً بعد از sleep طولانی).
 */
export function tick(state: PomodoroState, cfg: PomodoroConfig, now: number): TickResult {
  if (state.phase === 'idle' || state.endsAt === null || now < state.endsAt) {
    return { state, event: null };
  }
  const end = state.endsAt;

  if (state.phase === 'work') {
    const completed = state.completedWork + 1;
    const isLong = completed % cfg.longEvery === 0;
    const phase = isLong ? 'longBreak' : 'shortBreak';
    const length = isLong ? cfg.longBreakMs : cfg.shortBreakMs;
    return {
      state: { phase, startedAt: end, endsAt: end + length, completedWork: completed },
      event: { type: 'workEnded', at: end, nextBreak: phase },
    };
  }

  // پایان استراحت: برمی‌گردیم به idle و کاربر خودش دوباره شروع می‌کنه
  return {
    state: idleState(state.completedWork),
    event: { type: 'breakEnded', at: end },
  };
}

/** رد کردن استراحت (فقط وقتی تو استراحتیم معنی داره) */
export function skipBreak(state: PomodoroState): PomodoroState {
  if (state.phase !== 'shortBreak' && state.phase !== 'longBreak') return state;
  return idleState(state.completedWork);
}

/** ریست کامل سری (شمارنده هم صفر می‌شه) */
export function reset(): PomodoroState {
  return idleState(0);
}
