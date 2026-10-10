/*
 * ساخت پنجره‌ی اصلی (امن)
 * ------------------------
 * تنظیمات امنیتی: contextIsolation، sandbox، بدون nodeIntegration، webSecurity.
 * پنجره سریع باز می‌شه (show: false تا ready-to-show) و تا آماده شدن دیتابیس
 * IPCها صبر می‌کنن، پس کاربر صفحه‌ی خالی نمی‌بینه.
 */
import { BrowserWindow, nativeTheme, session, shell } from 'electron';
import path from 'node:path';
import { APP_ORIGIN, APP_URL } from './platform/security';

export interface WindowOptions {
  devUrl: string | undefined;
  /** مسیر preload ساخته‌شده (dist-electron/preload.cjs) */
  preloadPath: string;
  /** آیکون پنجره (ویندوز/لینوکس) */
  iconPath: string | undefined;
  isDark: boolean;
}

/** فقط لینک https بیرون باز می‌شه (با مرورگر سیستم) */
export function openExternalSafely(url: string): void {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') void shell.openExternal(u.toString());
  } catch {
    // آدرس خراب: نادیده
  }
}

/** همه‌ی مجوزهای مرورگر (دوربین، مکان، ...) رد می‌شه */
export function lockDownSession(): void {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
}

export function createMainWindow(opts: WindowOptions): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    show: false,
    title: 'TimeFlow',
    icon: opts.iconPath,
    backgroundColor: opts.isDark ? '#0b1312' : '#f3f6f5',
    autoHideMenuBar: true,
    webPreferences: {
      preload: opts.preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // هیچ پنجره‌ی جدیدی باز نمی‌شه؛ لینک https با مرورگر سیستم
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  // ناوبری بیرون از خود برنامه ممنوعه
  win.webContents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith(`${APP_ORIGIN}/`) ||
      (opts.devUrl !== undefined && url.startsWith(opts.devUrl));
    if (!allowed) {
      event.preventDefault();
      openExternalSafely(url);
    }
  });

  // webview ممنوع
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

  if (opts.devUrl) void win.loadURL(opts.devUrl);
  else void win.loadURL(APP_URL);

  return win;
}

/** هماهنگ کردن تم native (منو، scrollbar سیستم و ...) با تنظیم برنامه */
export function applyNativeTheme(theme: 'system' | 'light' | 'dark'): void {
  nativeTheme.themeSource = theme;
}

export const preloadFile = (distDir: string) => path.join(distDir, 'preload.cjs');
