/*
 * ساخت گزارش (خالص)
 * ------------------
 * ورودی: ثبت‌های خام + پروژه‌ها + بازه‌ی روزهای محلی + «الان».
 * خروجی: جمع زمان و درآمد، تفکیک روزانه (همه‌ی روزها حتی خالی) و تفکیک پروژه.
 * قوانین:
 *  - ثبت‌ها به بازه بریده می‌شن
 *  - ثبتی که از نیمه‌شب محلی رد شده بین روزها تقسیم می‌شه
 *  - ثبت فعال تا «الان» حساب می‌شه
 *  - درآمد هر پروژه = round(seconds × rate / 3600)
 */
import { earningsCents } from './format';
import type { CsvEntryRow } from './csv';
import { dayStart, eachDay, nextDayStart, toDayString } from './time';
import type { DateRange, Report, ReportDay, ReportProjectRow } from './types';

export interface ReportEntry {
  projectId: string;
  startedAt: string;
  endedAt: string | null;
}

export interface ReportProject {
  id: string;
  name: string;
  client: string;
  color: string;
  hourlyRateCents: number | null;
}

/**
 * یک ثبت رو به تکه‌های روزانه می‌شکنه: [{ day, ms }]
 * بازه‌ی [from, to) بر حسب ms و به نیمه‌شب‌های محلی بریده می‌شه.
 */
function splitByDay(
  startMs: number,
  endMs: number,
  rangeStartMs: number,
  rangeEndMs: number,
): Array<{ day: string; ms: number; start: number; end: number }> {
  const out: Array<{ day: string; ms: number; start: number; end: number }> = [];
  let cursor = Math.max(startMs, rangeStartMs);
  const end = Math.min(endMs, rangeEndMs);
  // سقف ایمنی: حداکثر ۸۰۰ روز
  for (let i = 0; i < 800 && cursor < end; i++) {
    const d = new Date(cursor);
    const day = toDayString(d);
    const boundary = nextDayStart(day).getTime();
    const chunkEnd = Math.min(boundary, end);
    out.push({ day, ms: chunkEnd - cursor, start: cursor, end: chunkEnd });
    cursor = chunkEnd;
  }
  return out;
}

export function buildReport(
  entries: ReportEntry[],
  projects: ReportProject[],
  range: DateRange,
  now: Date,
): Report {
  const rangeStartMs = dayStart(range.from).getTime();
  const rangeEndMs = nextDayStart(range.to).getTime();
  const nowMs = now.getTime();
  const byProject = new Map(projects.map((p) => [p.id, p]));

  // ms به تفکیک (پروژه، روز) — درآمد روزانه هم از همین حساب می‌شه
  const perProjectDay = new Map<string, Map<string, number>>();
  const entryCounted = new Map<string, number>();

  for (const e of entries) {
    const project = byProject.get(e.projectId);
    if (!project) continue;
    const startMs = Date.parse(e.startedAt);
    const endMs = e.endedAt === null ? nowMs : Date.parse(e.endedAt);
    if (!(endMs > startMs)) continue;
    const chunks = splitByDay(startMs, endMs, rangeStartMs, rangeEndMs);
    if (chunks.length === 0) continue;
    const days = perProjectDay.get(e.projectId) ?? new Map<string, number>();
    for (const c of chunks) days.set(c.day, (days.get(c.day) ?? 0) + c.ms);
    perProjectDay.set(e.projectId, days);
    entryCounted.set(e.projectId, (entryCounted.get(e.projectId) ?? 0) + 1);
  }

  const dayRows = new Map<string, ReportDay>(
    eachDay(range).map((date) => [date, { date, seconds: 0, earningsCents: 0 }]),
  );
  const projectRows: ReportProjectRow[] = [];

  for (const [projectId, days] of perProjectDay) {
    const p = byProject.get(projectId);
    if (!p) continue;
    let ms = 0;
    for (const [day, dayMs] of days) {
      ms += dayMs;
      const row = dayRows.get(day);
      if (row) {
        const secs = dayMs / 1000;
        row.seconds += secs;
        // درآمد روزانه رو از ثانیه‌ی خام جمع می‌کنیم و آخر کار گرد می‌کنیم
        row.earningsCents += (secs * (p.hourlyRateCents ?? 0)) / 3600;
      }
    }
    const seconds = Math.round(ms / 1000);
    projectRows.push({
      projectId,
      name: p.name,
      client: p.client,
      color: p.color,
      hourlyRateCents: p.hourlyRateCents,
      seconds,
      earningsCents: earningsCents(seconds, p.hourlyRateCents),
      entryCount: entryCounted.get(projectId) ?? 0,
    });
  }

  const days = [...dayRows.values()].map((d) => ({
    date: d.date,
    seconds: Math.round(d.seconds),
    earningsCents: Math.round(d.earningsCents),
  }));
  projectRows.sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));

  return {
    range,
    totalSeconds: projectRows.reduce((s, p) => s + p.seconds, 0),
    totalEarningsCents: projectRows.reduce((s, p) => s + p.earningsCents, 0),
    entryCount: projectRows.reduce((s, p) => s + p.entryCount, 0),
    days,
    projects: projectRows,
  };
}

/**
 * ردیف‌های CSV: هر ثبت به بازه بریده و بین روزها تقسیم می‌شه
 * تا جمع CSV با گزارش یکی باشه. ترتیب: قدیمی به جدید.
 */
export function buildCsvRows(
  entries: Array<ReportEntry & { description: string }>,
  projects: ReportProject[],
  range: DateRange,
  now: Date,
): CsvEntryRow[] {
  const rangeStartMs = dayStart(range.from).getTime();
  const rangeEndMs = nextDayStart(range.to).getTime();
  const byProject = new Map(projects.map((p) => [p.id, p]));
  const rows: Array<CsvEntryRow & { sortKey: number }> = [];

  for (const e of entries) {
    const p = byProject.get(e.projectId);
    if (!p) continue;
    const startMs = Date.parse(e.startedAt);
    const endMs = e.endedAt === null ? now.getTime() : Date.parse(e.endedAt);
    if (!(endMs > startMs)) continue;
    for (const c of splitByDay(startMs, endMs, rangeStartMs, rangeEndMs)) {
      rows.push({
        sortKey: c.start,
        startedAt: new Date(c.start).toISOString(),
        endedAt: new Date(c.end).toISOString(),
        projectName: p.name,
        client: p.client,
        description: e.description,
        hourlyRateCents: p.hourlyRateCents,
      });
    }
  }
  rows.sort((a, b) => a.sortKey - b.sortKey);
  return rows.map(({ sortKey: _sortKey, ...row }) => row);
}
