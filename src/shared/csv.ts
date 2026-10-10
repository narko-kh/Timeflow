/*
 * خروجی CSV (خالص)
 * -----------------
 * ستون‌ها: تاریخ، شروع، پایان، مدت (h:mm:ss)، ساعت (اعشاری)، پروژه، مشتری، توضیحات، نرخ، مبلغ
 * فایل با BOM (که اکسل فارسی رو درست بخونه) و پایان خط CRLF ساخته می‌شه.
 * جلوگیری از CSV injection: سلول متنی که با = + - @ تب یا CR شروع بشه، با ' شروع می‌شه.
 */
import { earningsCents, formatClock, secondsToHours } from './format';
import { toDayString } from './time';

export interface CsvEntryRow {
  startedAt: string;
  /** برای ثبت فعال، صدا‌زننده «الان» رو می‌ده */
  endedAt: string;
  projectName: string;
  client: string;
  description: string;
  hourlyRateCents: number | null;
}

export interface CsvHeaders {
  date: string;
  start: string;
  end: string;
  duration: string;
  hours: string;
  project: string;
  client: string;
  description: string;
  rate: string;
  amount: string;
}

const BOM = '﻿';
const FORMULA_START = /^[=+\-@\t\r]/;

/** محافظ فرمول: اگه سلول با کاراکتر خطرناک شروع شد، ' اولش می‌ذاریم */
export function guardFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

/** escape استاندارد CSV: اگه کاما، کوتیشن یا خط جدید داشت، داخل "" می‌ره */
export function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const textCell = (v: string) => escapeCell(guardFormula(v));

const pad = (n: number) => String(n).padStart(2, '0');
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const money = (cents: number) => (cents / 100).toFixed(2);

export function buildCsv(rows: CsvEntryRow[], headers: CsvHeaders): string {
  const head = [
    headers.date,
    headers.start,
    headers.end,
    headers.duration,
    headers.hours,
    headers.project,
    headers.client,
    headers.description,
    headers.rate,
    headers.amount,
  ]
    .map(textCell)
    .join(',');

  const lines = rows.map((r) => {
    const start = new Date(r.startedAt);
    const end = new Date(r.endedAt);
    const seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
    const rate = r.hourlyRateCents;
    return [
      toDayString(start),
      timeOf(start),
      timeOf(end),
      formatClock(seconds),
      secondsToHours(seconds).toFixed(2),
      textCell(r.projectName),
      textCell(r.client),
      textCell(r.description),
      rate === null ? '' : money(rate),
      rate === null ? '' : money(earningsCents(seconds, rate)),
    ].join(',');
  });

  return BOM + [head, ...lines].join('\r\n') + '\r\n';
}
