/*
 * کمک‌های تست
 * ------------
 * یک «برنامه‌ی کامل» با دیتابیس PGlite واقعی در حافظه، ساعت جعلی و اعلان‌های جمع‌شده می‌سازه.
 * بین تست‌ها فقط جدول‌ها TRUNCATE می‌شن تا راه‌اندازی WASM هر بار تکرار نشه.
 */
import { openDatabase, type Database } from '../electron/main/db/client';
import { runMigrations } from '../electron/main/db/migrations';
import { EntriesRepo } from '../electron/main/repositories/entries';
import { ProjectsRepo } from '../electron/main/repositories/projects';
import { SettingsRepo } from '../electron/main/repositories/settings';
import { EntriesService } from '../electron/main/services/entries';
import type { AppNotification, FileSaver, SaveTextOptions } from '../electron/main/services/ports';
import { ProjectsService } from '../electron/main/services/projects';
import { ReportsService } from '../electron/main/services/reports';
import { SettingsService } from '../electron/main/services/settings';
import { TimerService } from '../electron/main/services/timer';
import { createI18n } from '../src/shared/i18n';

export const MINUTE = 60_000;
export const HOUR = 3_600_000;

export interface TestApp {
  db: Database;
  clock: { now: number; advance(ms: number): void };
  idle: { seconds: number };
  notes: AppNotification[];
  saved: SaveTextOptions[];
  saveResult: { path: string | null };
  repos: { projects: ProjectsRepo; entries: EntriesRepo; settings: SettingsRepo };
  settings: SettingsService;
  timer: TimerService;
  projects: ProjectsService;
  entries: EntriesService;
  reports: ReportsService;
  /** سرویس‌ها رو دوباره از روی همون دیتابیس می‌سازه (شبیه‌سازی ری‌استارت برنامه) */
  restart(): Promise<TestApp>;
}

/** ساعت پایه: ۱۵ ژانویه ۲۰۲۵، ساعت ۱۰:۰۰ به وقت محلی */
export const BASE_TIME = new Date(2025, 0, 15, 10, 0, 0).getTime();

export async function createDb(): Promise<Database> {
  const db = await openDatabase();
  await runMigrations(db);
  return db;
}

export async function resetDb(db: Database): Promise<void> {
  await db.exec('TRUNCATE settings, time_entries, projects CASCADE');
}

export async function createApp(
  db: Database,
  startAt = BASE_TIME,
  platform = 'win32',
): Promise<TestApp> {
  const clock = {
    now: startAt,
    advance(ms: number) {
      this.now += ms;
    },
  };
  return build(db, clock, platform);
}

async function build(
  db: Database,
  clock: TestApp['clock'],
  platform: string,
  idle: TestApp['idle'] = { seconds: 0 },
  notes: AppNotification[] = [],
): Promise<TestApp> {
  const projectsRepo = new ProjectsRepo(db);
  const entriesRepo = new EntriesRepo(db);
  const settingsRepo = new SettingsRepo(db);
  const settings = new SettingsService(settingsRepo, platform);
  await settings.load();
  const saved: SaveTextOptions[] = [];
  const saveResult: { path: string | null } = { path: 'C:/tmp/out.csv' };
  const files: FileSaver = {
    async saveText(o) {
      saved.push(o);
      return saveResult.path;
    },
  };
  const i18n = createI18n('en');
  const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars) as string;
  const now = () => clock.now;
  const timer = new TimerService({
    db,
    entries: entriesRepo,
    projects: projectsRepo,
    settingsRepo,
    settings,
    notifier: { notify: (n) => notes.push(n) },
    clock: now,
    getIdleSeconds: () => idle.seconds,
  });
  return {
    db,
    clock,
    idle,
    notes,
    saved,
    saveResult,
    repos: { projects: projectsRepo, entries: entriesRepo, settings: settingsRepo },
    settings,
    timer,
    projects: new ProjectsService(projectsRepo, timer, now),
    entries: new EntriesService(entriesRepo, projectsRepo, timer, now),
    reports: new ReportsService(entriesRepo, projectsRepo, now, files, t),
    restart: () => build(db, clock, platform, idle, notes),
  };
}

/** پروژه‌ی تستی با نرخ دلخواه (به سنت) */
export async function makeProject(app: TestApp, name = 'Alpha', rate: number | null = 6000) {
  return app.projects.create({ name, client: 'ACME', color: '#0e9f8e', hourlyRateCents: rate });
}
