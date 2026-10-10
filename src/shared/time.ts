/*
 * کمک‌های تاریخ «محلی»
 * ---------------------
 * همه‌ی محاسبات روز/هفته/ماه با تاریخ محلی انجام می‌شن (نه UTC).
 * همه‌چیز با سازنده‌ی Date محلی ساخته می‌شه، پس تست‌ها به timezone دستگاه گره نمی‌خورن.
 */
import type { DateRange, Language } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD' بر اساس ساعت محلی */
export function toDayString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
}

/** 'YYYY-MM-DD' → نیمه‌شب محلی همون روز */
export function dayStart(day: string): Date {
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** نیمه‌شب محلی روز بعد (سر باز بازه) */
export function nextDayStart(day: string): Date {
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0);
}

/** افزودن n روز به یک رشته‌ی روز */
export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day);
  return toDayString(new Date(y, m - 1, d + n));
}

/** شروع هفته: فارسی شنبه (۶)، انگلیسی دوشنبه (۱) */
export function weekStartDay(lang: Language): number {
  return lang === 'fa' ? 6 : 1;
}

export function startOfWeek(date: Date, lang: Language): string {
  const diff = (date.getDay() - weekStartDay(lang) + 7) % 7;
  return addDays(toDayString(date), -diff);
}

export type RangePreset = 'today' | 'week' | 'month';

/** بازه‌ی پیش‌تنظیم‌شده نسبت به «الان» */
export function presetRange(preset: RangePreset, now: Date, lang: Language): DateRange {
  const today = toDayString(now);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'week') {
    const from = startOfWeek(now, lang);
    return { from, to: addDays(from, 6) };
  }
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from, to: toDayString(last) };
}

/** همه‌ی روزهای یک بازه (شامل دو سر) */
export function eachDay(range: DateRange): string[] {
  const out: string[] = [];
  let cur = range.from;
  // سقف ایمنی که حلقه بی‌نهایت نشه
  for (let i = 0; i < 800 && cur <= range.to; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
