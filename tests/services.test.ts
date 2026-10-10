/*
 * تست سرویس‌ها با دیتابیس PGlite واقعی (در حافظه) و ساعت جعلی
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MIGRATIONS, runMigrations } from '../electron/main/db/migrations';
import type { Database } from '../electron/main/db/client';
import { AppError } from '../electron/main/errors';
import { HEARTBEAT_KEY } from '../electron/main/services/timer';
import {
  BASE_TIME,
  HOUR,
  MINUTE,
  createApp,
  createDb,
  makeProject,
  resetDb,
  type TestApp,
} from './helpers';

let db: Database;
let app: TestApp;

beforeAll(async () => {
  db = await createDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await resetDb(db);
  app = await createApp(db);
});

/** انتظار یک AppError با کد مشخص */
async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ name: 'AppError', code });
}

const day = { from: '2025-01-15', to: '2025-01-15' };

describe('مهاجرت‌ها', () => {
  it('idempotent هستن: اجرای دوباره چیزی عوض نمی‌کنه', async () => {
    const again = await runMigrations(db);
    expect(again).toBe(0);
    const res = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM schema_migrations');
    expect(res.rows[0]?.n).toBe(MIGRATIONS.length);
  });
});

describe('تایمر: شروع/توقف', () => {
  it('شروع و توقف یک ثبت درست می‌سازه', async () => {
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: 'landing' });
    expect(app.timer.getState().active?.projectId).toBe(p.id);

    app.clock.advance(30 * MINUTE);
    await app.timer.stop();
    expect(app.timer.getState().active).toBeNull();

    const list = await app.entries.list(day);
    expect(list).toHaveLength(1);
    expect(list[0]?.description).toBe('landing');
    expect(Date.parse(list[0]?.endedAt ?? '') - Date.parse(list[0]?.startedAt ?? '')).toBe(30 * MINUTE);
    expect(list[0]?.source).toBe('timer');
  });

  it('یکتا بودن تایمر فعال: شروع جدید قبلی رو می‌بنده', async () => {
    const a = await makeProject(app, 'A');
    const b = await makeProject(app, 'B');
    await app.timer.start({ projectId: a.id, description: '' });
    app.clock.advance(10 * MINUTE);
    await app.timer.start({ projectId: b.id, description: '' });
    app.clock.advance(5 * MINUTE);

    const open = await db.query('SELECT 1 FROM time_entries WHERE ended_at IS NULL');
    expect(open.rows).toHaveLength(1);
    const list = await app.entries.list(day);
    expect(list).toHaveLength(2);
    const first = list.find((e) => e.projectId === a.id);
    expect(Date.parse(first?.endedAt ?? '') - Date.parse(first?.startedAt ?? '')).toBe(10 * MINUTE);
  });

  it('خود دیتابیس هم دو ثبت فعال رو اجازه نمی‌ده', async () => {
    const p = await makeProject(app);
    const iso = new Date(BASE_TIME).toISOString();
    await app.repos.entries.insert({ projectId: p.id, description: '', startedAt: iso, endedAt: null, source: 'timer' });
    await expect(
      app.repos.entries.insert({ projectId: p.id, description: '', startedAt: iso, endedAt: null, source: 'timer' }),
    ).rejects.toThrow();
  });

  it('ثبت کمتر از ۱ ثانیه ذخیره نمی‌شه', async () => {
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: '' });
    app.clock.advance(400);
    await app.timer.stop();
    expect(await app.entries.list(day)).toHaveLength(0);
  });

  it('پروژه‌ی بایگانی‌شده یا ناشناخته رد می‌شه', async () => {
    const p = await makeProject(app);
    await app.projects.setArchived(p.id, true);
    await expectCode(app.timer.start({ projectId: p.id, description: '' }), 'project_archived');
    await expectCode(
      app.timer.start({ projectId: '3f2b8f0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', description: '' }),
      'project_invalid',
    );
  });

  it('toggleLast: بدون ثبت = no_project؛ بعد ادامه‌ی آخرین پروژه؛ بعد توقف', async () => {
    await expectCode(app.timer.toggleLast(), 'no_project');
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: 'seo' });
    app.clock.advance(5 * MINUTE);
    await app.timer.toggleLast(); // خاموش
    expect(app.timer.getState().active).toBeNull();
    app.clock.advance(MINUTE);
    await app.timer.toggleLast(); // آخرین رو ادامه بده
    expect(app.timer.getState().active?.projectId).toBe(p.id);
    expect(app.timer.getState().active?.description).toBe('seo');
  });

  it('ویرایش ثبت فعال: فقط پروژه و توضیح', async () => {
    const a = await makeProject(app, 'A');
    const b = await makeProject(app, 'B');
    await app.timer.start({ projectId: a.id, description: 'x' });
    const id = app.timer.getState().active?.entryId as string;

    await app.entries.update({ id, description: 'y', projectId: b.id });
    expect(app.timer.getState().active?.description).toBe('y');
    expect(app.timer.getState().active?.projectId).toBe(b.id);

    await expectCode(app.entries.update({ id, startedAt: new Date(BASE_TIME - HOUR).toISOString() }), 'entry_active');
    await expectCode(app.entries.update({ id, endedAt: new Date(BASE_TIME + HOUR).toISOString() }), 'entry_active');
  });

  it('بایگانی یا حذف پروژه‌ی در حال ثبت، اول تایمر رو متوقف می‌کنه', async () => {
    const a = await makeProject(app, 'A');
    await app.timer.start({ projectId: a.id, description: '' });
    app.clock.advance(10 * MINUTE);
    await app.projects.setArchived(a.id, true);
    expect(app.timer.getState().active).toBeNull();
    expect(await app.entries.list(day)).toHaveLength(1);

    await app.projects.setArchived(a.id, false);
    await app.timer.start({ projectId: a.id, description: '' });
    app.clock.advance(10 * MINUTE);
    await app.projects.remove(a.id);
    expect(app.timer.getState().active).toBeNull();
    expect(await app.entries.list(day)).toHaveLength(0); // cascade
  });
});

describe('بازیابی بعد از کرش', () => {
  it('فاصله > ۲ دقیقه: ثبت تو لحظه‌ی آخرین ضربان بسته و اعلان داده می‌شه', async () => {
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: '' });
    app.clock.advance(20 * MINUTE);
    await app.timer.heartbeat();
    const beat = app.clock.now;
    app.clock.advance(3 * HOUR); // کرش: برنامه بسته مونده

    const after = await app.restart();
    await after.timer.init();
    expect(after.timer.getState().active).toBeNull();
    expect(after.notes).toContainEqual({ kind: 'recovered' });
    const list = await after.entries.list(day);
    expect(Date.parse(list[0]?.endedAt ?? '')).toBe(beat);
  });

  it('فاصله کم (ری‌استارت سریع): تایمر ادامه پیدا می‌کنه', async () => {
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: '' });
    app.clock.advance(MINUTE);
    await app.timer.heartbeat();
    app.clock.advance(30_000);

    const after = await app.restart();
    await after.timer.init();
    expect(after.timer.getState().active?.projectId).toBe(p.id);
    expect(after.notes).toHaveLength(0);
  });

  it('ضربان تو جدول settings با پیشوند meta. ذخیره می‌شه و تو تنظیمات کاربر نمیاد', async () => {
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: '' });
    expect(typeof (await app.repos.settings.get(HEARTBEAT_KEY))).toBe('string');
    expect(Object.keys(await app.repos.settings.getAll())).not.toContain(HEARTBEAT_KEY);
  });
});

describe('تشخیص بیکاری', () => {
  it('زمان بیکاری از ثبت حذف می‌شه', async () => {
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: '' });
    app.clock.advance(20 * MINUTE);
    app.idle.seconds = 6 * 60; // ۶ دقیقه بیکار
    await app.timer.checkIdle();

    expect(app.timer.getState().active).toBeNull();
    const list = await app.entries.list(day);
    const dur = Date.parse(list[0]?.endedAt ?? '') - Date.parse(list[0]?.startedAt ?? '');
    expect(dur).toBe(14 * MINUTE); // ۲۰ - ۶
    expect(app.notes).toContainEqual({ kind: 'idleStopped', minutes: 6 });
  });

  it('زیر آستانه یا خاموش بودن تشخیص: کاری نمی‌کنه', async () => {
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: '' });
    app.idle.seconds = 4 * 60;
    await app.timer.checkIdle();
    expect(app.timer.getState().active).not.toBeNull();

    await app.settings.update({ idleDetection: false });
    app.idle.seconds = 60 * 60;
    await app.timer.checkIdle();
    expect(app.timer.getState().active).not.toBeNull();
  });

  it('بیکاری بیشتر از طول ثبت: ثبت حذف می‌شه (منفی نمی‌شه)', async () => {
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: '' });
    app.clock.advance(2 * MINUTE);
    app.idle.seconds = 10 * 60;
    await app.timer.checkIdle();
    expect(await app.entries.list(day)).toHaveLength(0);
  });

  it('suspend سیستم تایمر رو متوقف می‌کنه', async () => {
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: '' });
    app.clock.advance(5 * MINUTE);
    await app.timer.onSuspend();
    expect(app.timer.getState().active).toBeNull();
  });
});

describe('Pomodoro با ثبت دقیق', () => {
  it('پایان تمرکز: ثبت دقیقاً تو لحظه‌ی پایان بسته می‌شه، اعلان استراحت داده می‌شه', async () => {
    await app.settings.update({ pomodoroEnabled: true });
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: 'deep work' });
    expect(app.timer.getState().pomodoro.phase).toBe('work');
    const startedAt = app.clock.now;

    app.clock.advance(27 * MINUTE); // tick با ۲ دقیقه تأخیر
    await app.timer.tick();

    const state = app.timer.getState();
    expect(state.active).toBeNull();
    expect(state.pomodoro.phase).toBe('shortBreak');
    const list = await app.entries.list(day);
    expect(list[0]?.source).toBe('pomodoro');
    expect(Date.parse(list[0]?.endedAt ?? '')).toBe(startedAt + 25 * MINUTE);
    expect(app.notes).toContainEqual({ kind: 'workDone', breakMinutes: 5 });
  });

  it('پایان استراحت اعلان می‌ده و رد کردن استراحت کار می‌کنه', async () => {
    await app.settings.update({ pomodoroEnabled: true });
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: '' });
    app.clock.advance(25 * MINUTE);
    await app.timer.tick();
    app.clock.advance(5 * MINUTE);
    await app.timer.tick();
    expect(app.notes).toContainEqual({ kind: 'breakDone' });
    expect(app.timer.getState().pomodoro.phase).toBe('idle');

    await app.timer.start({ projectId: p.id, description: '' });
    app.clock.advance(25 * MINUTE);
    await app.timer.tick();
    app.timer.skipBreak();
    expect(app.timer.getState().pomodoro.phase).toBe('idle');
  });

  it('خاموش بودن Pomodoro: ثبت بدون محدودیت ادامه پیدا می‌کنه', async () => {
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: '' });
    app.clock.advance(2 * HOUR);
    await app.timer.tick();
    expect(app.timer.getState().active).not.toBeNull();
  });
});

describe('ثبت دستی و ویرایش', () => {
  it('ثبت دستی ساخته می‌شه و قوانین اعمال می‌شن', async () => {
    const p = await makeProject(app);
    const ok = await app.entries.create({
      projectId: p.id,
      description: 'meeting',
      startedAt: new Date(2025, 0, 15, 8, 0).toISOString(),
      endedAt: new Date(2025, 0, 15, 9, 0).toISOString(),
    });
    expect(ok.source).toBe('manual');

    await expectCode(
      app.entries.create({
        projectId: p.id,
        description: '',
        startedAt: new Date(2025, 0, 15, 9, 0).toISOString(),
        endedAt: new Date(2025, 0, 15, 8, 0).toISOString(),
      }),
      'end_before_start',
    );
    await expectCode(
      app.entries.create({
        projectId: p.id,
        description: '',
        startedAt: new Date(2025, 0, 15, 9, 0).toISOString(),
        endedAt: new Date(2025, 0, 15, 12, 0).toISOString(), // بعد از «الان» (۱۰:۰۰)
      }),
      'end_in_future',
    );
  });

  it('ویرایش و حذف ثبت معمولی', async () => {
    const p = await makeProject(app);
    const e = await app.entries.create({
      projectId: p.id,
      description: 'a',
      startedAt: new Date(2025, 0, 15, 8, 0).toISOString(),
      endedAt: new Date(2025, 0, 15, 9, 0).toISOString(),
    });
    const u = await app.entries.update({ id: e.id, description: 'b', endedAt: new Date(2025, 0, 15, 9, 30).toISOString() });
    expect(u.description).toBe('b');
    await app.entries.remove(e.id);
    await expectCode(app.entries.remove(e.id), 'entry_not_found');
  });
});

describe('گزارش از دیتابیس', () => {
  it('جمع، درآمد، تقسیم نیمه‌شب و فیلتر پروژه', async () => {
    const a = await makeProject(app, 'A', 6000);
    const b = await makeProject(app, 'B', null);
    app.clock.now = new Date(2025, 0, 16, 12, 0).getTime();
    await app.entries.create({
      projectId: a.id,
      description: '',
      startedAt: new Date(2025, 0, 15, 23, 0).toISOString(),
      endedAt: new Date(2025, 0, 16, 1, 0).toISOString(),
    });
    await app.entries.create({
      projectId: b.id,
      description: '',
      startedAt: new Date(2025, 0, 16, 9, 0).toISOString(),
      endedAt: new Date(2025, 0, 16, 10, 0).toISOString(),
    });

    const range = { from: '2025-01-15', to: '2025-01-16' };
    const all = await app.reports.get(range);
    expect(all.totalSeconds).toBe(3 * 3600);
    expect(all.totalEarningsCents).toBe(12000);
    expect(all.days.map((d) => d.seconds)).toEqual([3600, 3600 + 3600]);

    const onlyB = await app.reports.get({ ...range, projectId: b.id });
    expect(onlyB.totalSeconds).toBe(3600);
    expect(onlyB.projects).toHaveLength(1);
  });

  it('ثبت فعال تو گزارش تا «الان» حساب می‌شه', async () => {
    const p = await makeProject(app);
    await app.timer.start({ projectId: p.id, description: '' });
    app.clock.advance(HOUR);
    const r = await app.reports.get(day);
    expect(r.totalSeconds).toBe(3600);
  });

  it('خروجی CSV با دیالوگ ذخیره ساخته می‌شه و لغو هم هندل می‌شه', async () => {
    const p = await makeProject(app, '=evil');
    await app.entries.create({
      projectId: p.id,
      description: 'x',
      startedAt: new Date(2025, 0, 15, 8, 0).toISOString(),
      endedAt: new Date(2025, 0, 15, 9, 0).toISOString(),
    });
    const res = await app.reports.exportCsv(day);
    expect(res).toEqual({ saved: true, path: 'C:/tmp/out.csv' });
    const content = app.saved[0]?.content ?? '';
    expect(content.startsWith('\uFEFF')).toBe(true);
    expect(content).toContain("'=evil");
    expect(content).toContain('Duration (h:mm:ss)');

    app.saveResult.path = null;
    expect(await app.reports.exportCsv(day)).toEqual({ saved: false });
  });

  it('بازه‌ی نامعتبر رد می‌شه', async () => {
    await expectCode(app.reports.get({ from: '2025-01-10', to: '2025-01-01' }), 'range_invalid');
  });
});

describe('پروژه‌ها و آمار', () => {
  it('آمار این ماه و کل زمان', async () => {
    const p = await makeProject(app, 'Stats', 6000);
    await app.entries.create({
      projectId: p.id,
      description: '',
      startedAt: new Date(2025, 0, 10, 8, 0).toISOString(),
      endedAt: new Date(2025, 0, 10, 10, 0).toISOString(),
    });
    // ثبت ماه قبل (در حافظه با repo مستقیم تا قانون آینده/گذشته مزاحم نشه)
    await app.repos.entries.insert({
      projectId: p.id,
      description: '',
      startedAt: new Date(2024, 11, 20, 8, 0).toISOString(),
      endedAt: new Date(2024, 11, 20, 9, 0).toISOString(),
      source: 'manual',
    });
    const list = await app.projects.list();
    const s = list.find((x) => x.id === p.id);
    expect(s?.monthSeconds).toBe(2 * 3600);
    expect(s?.totalSeconds).toBe(3 * 3600);
    expect(s?.monthEarningsCents).toBe(12000);
  });

  it('اعتبارسنجی ساخت پروژه', async () => {
    await expectCode(app.projects.create({ name: '', client: '', color: '#000000', hourlyRateCents: null }), 'name_required');
    await expectCode(app.projects.create({ name: 'x', client: '', color: 'nope', hourlyRateCents: null }), 'color_invalid');
  });
});

describe('تنظیمات ماندگار', () => {
  it('بعد از ری‌استارت همون مقدارها برمی‌گردن', async () => {
    await app.settings.update({ language: 'fa', theme: 'dark', idleMinutes: 12 });
    const after = await app.restart();
    expect(after.settings.get()).toMatchObject({ language: 'fa', theme: 'dark', idleMinutes: 12 });
  });

  it('پیش‌فرض closeToTray: ویندوز روشن، لینوکس خاموش', async () => {
    expect(app.settings.get().closeToTray).toBe(true);
    const linux = await createApp(db, BASE_TIME, 'linux');
    expect(linux.settings.get().closeToTray).toBe(false);
  });

  it('کلید ناشناخته و مقدار بد رد می‌شه', async () => {
    await expect(app.settings.update({ nope: 1 })).rejects.toBeInstanceOf(AppError);
    await expectCode(app.settings.update({ theme: 'neon' }), 'settings_invalid');
  });

  it('مقدار خراب تو دیتابیس با پیش‌فرض جایگزین می‌شه', async () => {
    await app.repos.settings.set('idleMinutes', 'abc');
    const after = await app.restart();
    expect(after.settings.get().idleMinutes).toBe(5);
  });
});
