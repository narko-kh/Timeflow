/*
 * قالب‌بندی مدت و پول
 * --------------------
 * ساعت تایمر همیشه لاتین و LTR هست (h:mm:ss)؛ اعداد دیگه با Intl محلی می‌شن.
 */

/** ثانیه → h:mm:ss (ارقام لاتین) */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** ثانیه → ساعت اعشاری با دو رقم (برای CSV) */
export function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

/** درآمد: round(seconds × rate / 3600) به سنت */
export function earningsCents(seconds: number, rateCents: number | null): number {
  if (rateCents === null || rateCents <= 0) return 0;
  return Math.round((seconds * rateCents) / 3600);
}
