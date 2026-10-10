/*
 * تست اعتبارسنجی ورودی‌ها
 */
import { describe, expect, it } from 'vitest';
import {
  parseEntryUpdate,
  parseId,
  parseManualEntry,
  parseProjectInput,
  parseRange,
  parseSettingsPatch,
  parseStartInput,
} from '../src/shared/validation';

const ID = '3f2b8f0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

describe('parseId', () => {
  it('uuid خوب رو می‌پذیره', () => {
    expect(parseId(ID)).toEqual({ ok: true, value: ID });
  });
  it('ورودی بد رو رد می‌کنه', () => {
    for (const bad of ['', 'abc', 123, null, undefined, `${ID}x`, "1'; DROP TABLE projects;--"]) {
      expect(parseId(bad)).toEqual({ ok: false, code: 'id_invalid' });
    }
  });
});

describe('parseProjectInput', () => {
  const good = { name: '  Site  ', client: 'ACME', color: '#0E9F8E', hourlyRateCents: 5000 };

  it('تمیز می‌کنه و می‌پذیره', () => {
    expect(parseProjectInput(good)).toEqual({
      ok: true,
      value: { name: 'Site', client: 'ACME', color: '#0e9f8e', hourlyRateCents: 5000 },
    });
  });
  it('نرخ خالی = null', () => {
    const r = parseProjectInput({ ...good, hourlyRateCents: null });
    expect(r.ok && r.value.hourlyRateCents).toBeNull();
  });
  it('اسم خالی یا طولانی رد می‌شه', () => {
    expect(parseProjectInput({ ...good, name: '   ' })).toEqual({ ok: false, code: 'name_required' });
    expect(parseProjectInput({ ...good, name: 'x'.repeat(81) })).toEqual({
      ok: false,
      code: 'name_too_long',
    });
  });
  it('رنگ بد رد می‌شه', () => {
    for (const color of ['red', '#fff', '#12345g', 5]) {
      expect(parseProjectInput({ ...good, color })).toEqual({ ok: false, code: 'color_invalid' });
    }
  });
  it('نرخ منفی/اعشاری/رشته رد می‌شه', () => {
    for (const r of [-1, 1.5, '10', NaN, 1e12]) {
      expect(parseProjectInput({ ...good, hourlyRateCents: r })).toEqual({
        ok: false,
        code: 'rate_invalid',
      });
    }
  });
});

describe('parseStartInput / parseManualEntry / parseEntryUpdate', () => {
  it('شروع تایمر: پروژه‌ی بد = project_invalid', () => {
    expect(parseStartInput({ projectId: 'nope', description: '' })).toEqual({
      ok: false,
      code: 'project_invalid',
    });
  });
  it('توضیح خیلی طولانی رد می‌شه', () => {
    expect(parseStartInput({ projectId: ID, description: 'a'.repeat(281) })).toEqual({
      ok: false,
      code: 'description_too_long',
    });
  });
  it('ثبت دستی: پایان قبل از شروع رد می‌شه', () => {
    const r = parseManualEntry({
      projectId: ID,
      description: '',
      startedAt: '2025-01-01T10:00:00Z',
      endedAt: '2025-01-01T09:00:00Z',
    });
    expect(r).toEqual({ ok: false, code: 'end_before_start' });
  });
  it('تاریخ بدون timezone یا خراب رد می‌شه', () => {
    for (const startedAt of ['2025-01-01', '2025-01-01T10:00:00', 'yesterday', 5]) {
      const r = parseManualEntry({
        projectId: ID,
        description: '',
        startedAt,
        endedAt: '2025-01-01T10:00:00Z',
      });
      expect(r).toEqual({ ok: false, code: 'date_invalid' });
    }
  });
  it('ثبت دستی خوب پذیرفته می‌شه', () => {
    const r = parseManualEntry({
      projectId: ID,
      description: 'کار',
      startedAt: '2025-01-01T09:00:00Z',
      endedAt: '2025-01-01T10:00:00Z',
    });
    expect(r.ok).toBe(true);
  });
  it('ویرایش: فقط فیلدهای معتبر', () => {
    expect(parseEntryUpdate({ id: ID, description: 'x' }).ok).toBe(true);
    expect(parseEntryUpdate({ id: 'bad' })).toEqual({ ok: false, code: 'id_invalid' });
    expect(parseEntryUpdate({ id: ID, projectId: 'bad' })).toEqual({
      ok: false,
      code: 'project_invalid',
    });
  });
});

describe('parseRange', () => {
  it('بازه‌ی خوب', () => {
    expect(parseRange({ from: '2025-01-01', to: '2025-01-31' }).ok).toBe(true);
  });
  it('تاریخ غیرواقعی رد می‌شه', () => {
    expect(parseRange({ from: '2025-02-30', to: '2025-03-01' })).toEqual({
      ok: false,
      code: 'range_invalid',
    });
  });
  it('برعکس بودن رد می‌شه', () => {
    expect(parseRange({ from: '2025-02-10', to: '2025-02-01' })).toEqual({
      ok: false,
      code: 'range_invalid',
    });
  });
  it('بیشتر از ۴۰۰ روز رد می‌شه، دقیقاً ۴۰۰ روز مجازه', () => {
    expect(parseRange({ from: '2024-01-01', to: '2025-12-31' })).toEqual({
      ok: false,
      code: 'range_too_large',
    });
    expect(parseRange({ from: '2024-01-01', to: '2025-02-03' }).ok).toBe(true); // ۴۰۰ روز
    expect(parseRange({ from: '2024-01-01', to: '2025-02-04' })).toEqual({
      ok: false,
      code: 'range_too_large',
    });
  });
});

describe('parseSettingsPatch', () => {
  it('کلید ناشناخته رد می‌شه', () => {
    expect(parseSettingsPatch({ hack: true })).toEqual({ ok: false, code: 'unknown_setting' });
  });
  it('مقدار نامعتبر رد می‌شه', () => {
    expect(parseSettingsPatch({ language: 'de' })).toEqual({ ok: false, code: 'settings_invalid' });
    expect(parseSettingsPatch({ idleMinutes: 0 })).toEqual({ ok: false, code: 'settings_invalid' });
    expect(parseSettingsPatch({ currency: 'BTC' })).toEqual({ ok: false, code: 'settings_invalid' });
  });
  it('مقدار خوب پذیرفته می‌شه', () => {
    expect(parseSettingsPatch({ language: 'fa', theme: 'dark', idleMinutes: 10 }).ok).toBe(true);
  });
  it('آبجکت خالی رد می‌شه', () => {
    expect(parseSettingsPatch({})).toEqual({ ok: false, code: 'settings_invalid' });
  });
});
