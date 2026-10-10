/*
 * ریشه‌ی ترکیب برنامه (composition root) — پروسه‌ی Main
 * --------------------------------------------------------
 * اینجا همه‌چیز به هم وصل می‌شه: دیتابیس → ریپازیتوری‌ها → سرویس‌ها → IPC / tray / میان‌بر.
 * سرویس‌ها خودشون چیزی از Electron نمی‌دونن؛ هر وابستگی دسکتاپی از اینجا تزریق می‌شه.
 *
 * جریان شروع:
 *  ۱. پنجره سریع باز می‌شه (کاربر صفحه‌ی خالی نمی‌بینه)
 *  ۲. دیتابیس تو پس‌زمینه آماده می‌شه؛ IPCها تا آماده شدنش صبر می‌کنن
 */
import { Channels } from '@shared/channels';
import { createI18n } from '@shared/i18n';
import { resolveLanguage } from '@shared/settings';
import type { Language, Settings, SystemInfo, TimerState } from '@shared/types';
import { BrowserWindow, app, powerMonitor } from 'electron';
import path from 'node:path';
import { openDatabase, type Database } from './db/client';
import { runMigrations } from './db/migrations';
import { registerIpc, type IpcServices } from './ipc/handlers';
import { DialogFileSaver } from './platform/file-saver';
import { setupAppMenu } from './platform/menu';
import { DesktopNotifier } from './platform/notifier';
import { registerAppProtocol, registerSchemePrivileges } from './platform/protocol';
import { ShortcutManager, SHORTCUT_ACCELERATOR } from './platform/shortcut';
import { TrayController } from './platform/tray';
import { EntriesRepo } from './repositories/entries';
import { ProjectsRepo } from './repositories/projects';
import { SettingsRepo } from './repositories/settings';
import { EntriesService } from './services/entries';
import { ProjectsService } from './services/projects';
import { ReportsService } from './services/reports';
import { SettingsService } from './services/settings';
import { TimerService } from './services/timer';
import { applyNativeTheme, createMainWindow, lockDownSession } from './window';

// برای تست‌های e2e: پوشه‌ی داده رو می‌شه از بیرون عوض کرد
if (process.env.TIMEFLOW_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.TIMEFLOW_USER_DATA));
}

const devUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
const platform = process.platform;

// قبل از ready لازمه
registerSchemePrivileges();

let mainWindow: BrowserWindow | null = null;
let quitting = false;
let cleanedUp = false;

/** نمایش پنجره (و ساخت دوباره اگه بسته شده باشه) */
function showWindow(createWindow: () => BrowserWindow): void {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** ارسال رویداد به همه‌ی پنجره‌ها */
function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function bootstrap(): void {
  const assetsDir = path.join(app.getAppPath(), 'assets');
  const distDir = __dirname;
  const iconPath = platform === 'darwin' ? undefined : path.join(assetsDir, 'icon.png');

  // ---- زبان و ترجمه برای Main (tray، اعلان، دیالوگ) ----
  const i18n = createI18n('en');
  const t = (key: string, vars?: Record<string, string | number>): string =>
    i18n.t(key, vars) as string;
  const applyLanguage = (s: Settings): Language => {
    const lang = resolveLanguage(s.language, app.getLocale());
    void i18n.changeLanguage(lang);
    return lang;
  };

  const createWindow = (): BrowserWindow => {
    const win = createMainWindow({
      devUrl,
      preloadPath: path.join(distDir, 'preload.cjs'),
      iconPath,
      isDark: false,
    });
    // بستن پنجره: tray (یا مخفی شدن روی مک) به‌جای خروج
    win.on('close', (event) => {
      if (quitting) return;
      const keepInTray =
        platform === 'darwin' || (currentSettings().closeToTray && tray.available);
      if (keepInTray) {
        event.preventDefault();
        win.hide();
      }
    });
    win.on('closed', () => {
      if (mainWindow === win) mainWindow = null;
    });
    return win;
  };

  // settings هنوز بارگذاری نشده؛ تا اون موقع مقدار پیش‌فرضِ امن
  let services: IpcServices | null = null;
  const currentSettings = (): Settings =>
    services?.settings.get() ?? ({ closeToTray: platform === 'win32' } as Settings);

  // ---- ابزارهای دسکتاپ ----
  let timerRef: TimerService | null = null;
  let projectsRepoRef: ProjectsRepo | null = null;
  let entriesRepoRef: EntriesRepo | null = null;

  const tray = new TrayController({
    assetsDir,
    platform,
    t,
    getState: () => timerRef?.getState() ?? { active: null, pomodoro: { phase: 'idle', startedAt: null, endsAt: null, completedWork: 0 } },
    getProjectName: async (projectId) => {
      if (!projectsRepoRef || !entriesRepoRef) return null;
      let id = projectId;
      if (!id) id = (await entriesRepoRef.getLast())?.projectId ?? null;
      if (!id) return null;
      return (await projectsRepoRef.get(id))?.name ?? null;
    },
    now: () => Date.now(),
    onShow: () => showWindow(createWindow),
    onToggle: () => void timerRef?.toggleLast().catch(() => undefined),
    onQuit: () => app.quit(),
  });

  const shortcut = new ShortcutManager(() => {
    void timerRef?.toggleLast().catch(() => undefined);
  });

  setupAppMenu(platform);
  lockDownSession();
  if (!devUrl) registerAppProtocol(path.join(app.getAppPath(), 'out'));
  mainWindow = createWindow();
  tray.create();

  // ---- دیتابیس و سرویس‌ها (پس‌زمینه) ----
  let db: Database | null = null;

  const ready: Promise<IpcServices> = (async () => {
    db = await openDatabase(path.join(app.getPath('userData'), 'database'));
    await runMigrations(db);

    const projectsRepo = new ProjectsRepo(db);
    const entriesRepo = new EntriesRepo(db);
    const settingsRepo = new SettingsRepo(db);
    projectsRepoRef = projectsRepo;
    entriesRepoRef = entriesRepo;

    const settings = new SettingsService(settingsRepo, platform);
    await settings.load();
    applyLanguage(settings.get());
    applyNativeTheme(settings.get().theme);

    const clock = () => Date.now();
    const notifier = new DesktopNotifier(t, () => showWindow(createWindow));
    const timer = new TimerService({
      db,
      entries: entriesRepo,
      projects: projectsRepo,
      settingsRepo,
      settings,
      notifier,
      clock,
      getIdleSeconds: () => powerMonitor.getSystemIdleTime(),
    });
    timerRef = timer;
    await timer.init();

    const files = new DialogFileSaver(() => mainWindow);
    const built: IpcServices = {
      projects: new ProjectsService(projectsRepo, timer, clock),
      entries: new EntriesService(entriesRepo, projectsRepo, timer, clock),
      timer,
      reports: new ReportsService(entriesRepo, projectsRepo, clock, files, t),
      settings,
      getSystemInfo: (): SystemInfo => ({
        appVersion: app.getVersion(),
        platform: platform as SystemInfo['platform'],
        locale: app.getLocale(),
        dataPath: app.getPath('userData'),
        shortcut: { accelerator: SHORTCUT_ACCELERATOR, registered: shortcut.isRegistered },
        trayAvailable: tray.available,
      }),
    };
    services = built;

    // تغییر وضعیت تایمر → صفحه و tray
    timer.onState((state: TimerState) => {
      broadcast(Channels.timerState, state);
      void tray.refresh();
    });
    // تغییر تنظیمات → تم، زبان، میان‌بر، tray، صفحه
    settings.onChange((s) => {
      applyNativeTheme(s.theme);
      applyLanguage(s);
      shortcut.apply(s.shortcutEnabled);
      void tray.refresh();
      broadcast(Channels.settingsChanged, s);
    });
    shortcut.apply(settings.get().shortcutEnabled);
    void tray.refresh();

    // کارهای دوره‌ای: Pomodoro هر ثانیه، بیکاری هر ۱۰ ثانیه، ضربان هر ۳۰ ثانیه
    const guard = (fn: () => Promise<void>) => () => {
      fn().catch((err) => console.error('[timeflow] periodic task failed', err));
    };
    setInterval(guard(() => timer.tick()), 1000).unref();
    setInterval(guard(() => timer.checkIdle()), 10_000).unref();
    setInterval(guard(() => timer.heartbeat()), 30_000).unref();
    setInterval(() => void tray.refresh(), 15_000).unref();

    powerMonitor.on('suspend', guard(() => timer.onSuspend()));

    return built;
  })();

  // اگه راه‌اندازی شکست بخوره، لاگ می‌شه و IPCها خطای internal می‌دن
  ready.catch((err) => console.error('[timeflow] startup failed', err));

  registerIpc({
    ready,
    devUrl,
    onError: (err) => console.error('[timeflow] ipc handler failed', err),
  });

  // ---- چرخه‌ی عمر برنامه ----
  app.on('second-instance', () => showWindow(createWindow));
  app.on('activate', () => showWindow(createWindow));
  app.on('window-all-closed', () => {
    if (platform !== 'darwin') app.quit();
  });

  app.on('before-quit', (event) => {
    quitting = true;
    if (cleanedUp) return;
    event.preventDefault();
    cleanedUp = true;
    void (async () => {
      try {
        shortcut.unregister();
        tray.destroy();
        await timerRef?.shutdown();
        await db?.close();
      } catch (err) {
        console.error('[timeflow] cleanup failed', err);
      } finally {
        app.quit();
      }
    })();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app.whenReady().then(bootstrap);
}
