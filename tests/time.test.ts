/*
 * تست کمک‌های تاریخ محلی (هفته‌ی فارسی/انگلیسی، ماه، روزها)
 */
import { describe, expect, it } from 'vitest';
import { addDays, eachDay, presetRange, startOfWeek, toDayString } from '../src/shared/time';

// ۱۵ ژانویه ۲۰۲۵ چهارشنبه‌ست
const WED = new Date(2025, 0, 15, 12, 0, 0);

describe('time', () => {
  it('شروع هفته: انگلیسی دوشنبه، فارسی شنبه', () => {
    expect(startOfWeek(WED, 'en')).toBe('2025-01-13');
    expect(startOfWeek(WED, 'fa')).toBe('2025-01-11');
  });
  it('اگه امروز دقیقاً شنبه باشه، هفته‌ی فارسی از امروز شروع می‌شه', () => {
    expect(startOfWeek(new Date(2025, 0, 11, 9), 'fa')).toBe('2025-01-11');
  });
  it('پیش‌تنظیم‌ها', () => {
    expect(presetRange('today', WED, 'en')).toEqual({ from: '2025-01-15', to: '2025-01-15' });
    expect(presetRange('week', WED, 'en')).toEqual({ from: '2025-01-13', to: '2025-01-19' });
    expect(presetRange('week', WED, 'fa')).toEqual({ from: '2025-01-11', to: '2025-01-17' });
    expect(presetRange('month', WED, 'en')).toEqual({ from: '2025-01-01', to: '2025-01-31' });
  });
  it('ماه کبیسه', () => {
    expect(presetRange('month', new Date(2024, 1, 10), 'en').to).toBe('2024-02-29');
  });
  it('addDays و عبور از ماه/سال', () => {
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
  });
  it('eachDay همه‌ی روزها رو می‌ده', () => {
    expect(eachDay({ from: '2025-01-30', to: '2025-02-02' })).toEqual([
      '2025-01-30',
      '2025-01-31',
      '2025-02-01',
      '2025-02-02',
    ]);
    expect(toDayString(new Date(2025, 11, 5))).toBe('2025-12-05');
  });
});
