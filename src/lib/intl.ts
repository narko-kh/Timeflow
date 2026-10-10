/*
 * قالب‌بندی عدد، پول، مدت و تاریخ با Intl
 * -----------------------------------------
 * فارسی: fa-IR (ارقام فارسی، تقویم جلالی برای نمایش)؛ انگلیسی: en-US.
 * فقط ساعت بزرگ تایمر لاتین می‌مونه (formatClock تو shared).
 */
import type { Language } from '@shared/types';

export const localeFor = (lang: Language): string => (lang === 'fa' ? 'fa-IR' : 'en-US');

export function formatNumber(value: number, lang: Language, digits = 0): string {
  return new Intl.NumberFormat(localeFor(lang), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** مبلغ از سنت (صدم واحد اصلی) با واحد پول */
export function formatMoney(cents: number, currency: string, lang: Language): string {
  try {
    return new Intl.NumberFormat(localeFor(lang), {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'IRR' ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return formatNumber(cents / 100, lang, 2);
  }
}

/** ثانیه → h:mm (یا h:mm:ss) با ارقام محلی برای لیست‌ها و جدول‌ها */
export function formatDuration(seconds: number, lang: Language, withSeconds = false): string {
  const total = Math.max(0, withSeconds ? Math.floor(seconds) : Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const nf = new Intl.NumberFormat(localeFor(lang), { minimumIntegerDigits: 2, useGrouping: false });
  const hf = new Intl.NumberFormat(localeFor(lang), { useGrouping: false });
  const base = `${hf.format(h)}:${nf.format(m)}`;
  return withSeconds ? `${base}:${nf.format(total % 60)}` : base;
}

/** ساعت اعشاری (برای نمودار و tooltip) */
export function formatHours(seconds: number, lang: Language): string {
  return formatNumber(seconds / 3600, lang, 1);
}

export function formatTimeOfDay(iso: string, lang: Language): string {
  return new Intl.DateTimeFormat(localeFor(lang), { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export function formatDayLabel(day: string, lang: Language, style: 'short' | 'long' = 'short'): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(
    localeFor(lang),
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'short' },
  ).format(date);
}

export function formatWeekday(day: string, lang: Language): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(localeFor(lang), { weekday: 'short' }).format(new Date(y, m - 1, d));
}

/** مقدار input[type=time] ('HH:mm') از Date */
export function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' + 'HH:mm' (محلی) → ISO */
export function localToIso(day: string, time: string): string {
  const [y, mo, d] = day.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  return new Date(y, mo - 1, d, h, mi, 0, 0).toISOString();
}
