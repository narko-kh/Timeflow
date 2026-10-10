/*
 * مقدارهای پیش‌فرض تنظیمات + کمک‌های زبان
 * ------------------------------------------
 * پیش‌فرض «ادامه در tray با بستن پنجره» بسته به سیستم‌عامل فرق می‌کنه:
 * ویندوز روشن (tray همیشه هست)، لینوکس خاموش (ممکنه tray نباشه)، مک هم همیشه مخفی می‌کنه.
 */
import { DEFAULT_POMODORO } from './pomodoro';
import type { Language, LanguageSetting, PomodoroConfig, Settings } from './types';

export function defaultSettings(platform: string): Settings {
  return {
    language: 'system',
    theme: 'system',
    currency: 'USD',
    idleDetection: true,
    idleMinutes: 5,
    pomodoroEnabled: false,
    pomodoroWorkMinutes: 25,
    pomodoroShortBreakMinutes: 5,
    pomodoroLongBreakMinutes: 15,
    pomodoroLongEvery: 4,
    closeToTray: platform === 'win32',
    shortcutEnabled: true,
  };
}

/** زبان واقعی: system → از locale سیستم‌عامل (fa* → فارسی، وگرنه انگلیسی) */
export function resolveLanguage(setting: LanguageSetting, systemLocale: string): Language {
  if (setting === 'en' || setting === 'fa') return setting;
  return systemLocale.toLowerCase().startsWith('fa') ? 'fa' : 'en';
}

export function pomodoroConfigFrom(s: Settings): PomodoroConfig {
  return {
    workMs: s.pomodoroWorkMinutes * 60_000,
    shortBreakMs: s.pomodoroShortBreakMinutes * 60_000,
    longBreakMs: s.pomodoroLongBreakMinutes * 60_000,
    longEvery: s.pomodoroLongEvery || DEFAULT_POMODORO.longEvery,
  };
}
