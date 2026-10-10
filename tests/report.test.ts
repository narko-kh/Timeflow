/*
 * تست ساخت گزارش (خالص، با تاریخ‌های محلی)
 */
import { describe, expect, it } from 'vitest';
import {
  buildCsvRows,
  buildReport,
  type ReportEntry,
  type ReportProject,
} from '../src/shared/report';

const P1: ReportProject = { id: 'p1', name: 'Alpha', client: 'A', color: '#111111', hourlyRateCents: 6000 };
const P2: ReportProject = { id: 'p2', name: 'Beta', client: 'B', color: '#222222', hourlyRateCents: null };

const at = (d: number, h: number, m = 0, s = 0) => new Date(2025, 0, d, h, m, s).toISOString();
const entry = (projectId: string, start: string, end: string | null): ReportEntry => ({
  projectId,
  startedAt: start,
  endedAt: end,
});

const now = new Date(2025, 0, 20, 12, 0, 0);
const day15 = { from: '2025-01-15', to: '2025-01-15' };

describe('buildReport', () => {
  it('جمع زمان و درآمد: round(seconds × rate / 3600)', () => {
    const r = buildReport(
      [entry('p1', at(15, 9), at(15, 10, 30)), entry('p2', at(15, 11), at(15, 12))],
      [P1, P2],
      day15,
      now,
    );
    expect(r.totalSeconds).toBe(5400 + 3600);
    // ۱.۵ ساعت × ۶۰.۰۰ = ۹۰.۰۰ → ۹۰۰۰ سنت
    expect(r.totalEarningsCents).toBe(9000);
    expect(r.entryCount).toBe(2);
    const alpha = r.projects.find((p) => p.projectId === 'p1');
    expect(alpha?.seconds).toBe(5400);
    expect(alpha?.earningsCents).toBe(9000);
    expect(r.projects.find((p) => p.projectId === 'p2')?.earningsCents).toBe(0);
  });

  it('گرد کردن درآمد', () => {
    // ۱۰ ثانیه × ۶۰۰۰ / ۳۶۰۰ = ۱۶.۶۶ → ۱۷
    const r = buildReport([entry('p1', at(15, 9), at(15, 9, 0, 10))], [P1], day15, now);
    expect(r.totalEarningsCents).toBe(17);
  });

  it('ثبتی که از نیمه‌شب رد شده بین روزها تقسیم می‌شه', () => {
    const r = buildReport(
      [entry('p1', at(15, 23), at(16, 1))],
      [P1],
      { from: '2025-01-15', to: '2025-01-16' },
      now,
    );
    expect(r.days).toEqual([
      { date: '2025-01-15', seconds: 3600, earningsCents: 6000 },
      { date: '2025-01-16', seconds: 3600, earningsCents: 6000 },
    ]);
    expect(r.totalSeconds).toBe(7200);
  });

  it('ثبت به بازه بریده می‌شه (فقط بخش داخل بازه حساب می‌شه)', () => {
    const r = buildReport(
      [entry('p1', at(15, 23), at(16, 1))],
      [P1],
      { from: '2025-01-16', to: '2025-01-16' },
      now,
    );
    expect(r.totalSeconds).toBe(3600);
  });

  it('ثبت فعال تا «الان» حساب می‌شه', () => {
    const r = buildReport(
      [entry('p1', at(20, 10), null)],
      [P1],
      { from: '2025-01-20', to: '2025-01-20' },
      now,
    );
    expect(r.totalSeconds).toBe(2 * 3600);
  });

  it('همه‌ی روزهای بازه (حتی خالی) برمی‌گرده', () => {
    const r = buildReport([], [P1], { from: '2025-01-01', to: '2025-01-07' }, now);
    expect(r.days).toHaveLength(7);
    expect(r.days.every((d) => d.seconds === 0)).toBe(true);
    expect(r.projects).toEqual([]);
  });

  it('ثبت پروژه‌ی ناشناخته نادیده گرفته می‌شه', () => {
    const r = buildReport([entry('zzz', at(15, 9), at(15, 10))], [P1], day15, now);
    expect(r.totalSeconds).toBe(0);
  });

  it('مرتب‌سازی پروژه‌ها بر اساس زمان نزولی', () => {
    const r = buildReport(
      [entry('p1', at(15, 9), at(15, 10)), entry('p2', at(15, 10), at(15, 12))],
      [P1, P2],
      day15,
      now,
    );
    expect(r.projects.map((p) => p.projectId)).toEqual(['p2', 'p1']);
  });
});

describe('buildCsvRows', () => {
  it('ردیف‌ها تقسیم روزانه و مرتب هستن', () => {
    const rows = buildCsvRows(
      [{ ...entry('p1', at(15, 23), at(16, 1)), description: 'late' }],
      [P1],
      { from: '2025-01-15', to: '2025-01-16' },
      now,
    );
    expect(rows).toHaveLength(2);
    const midnight = new Date(2025, 0, 16, 0, 0, 0).getTime();
    expect(rows[0]?.description).toBe('late');
    expect(new Date(rows[0]?.endedAt ?? '').getTime()).toBe(midnight);
    expect(new Date(rows[1]?.startedAt ?? '').getTime()).toBe(midnight);
  });
});
