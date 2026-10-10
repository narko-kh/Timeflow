/*
 * پورت‌ها (interfaceهای وابستگی‌های بیرونی)
 * -------------------------------------------
 * سرویس‌ها به Electron وابسته نیستن؛ هر چیزی که از دنیای بیرون لازم دارن
 * از طریق این interfaceها تزریق می‌شه تا تو تست با نسخه‌ی جعلی جایگزین بشن.
 */

/** ساعت — میلی‌ثانیه‌ی epoch */
export type Clock = () => number;

/** ثانیه‌های بیکاری سیستم (powerMonitor.getSystemIdleTime) */
export type IdleProvider = () => number;

export type AppNotification =
  | { kind: 'recovered' }
  | { kind: 'idleStopped'; minutes: number }
  | { kind: 'workDone'; breakMinutes: number }
  | { kind: 'breakDone' };

export interface Notifier {
  notify(n: AppNotification): void;
}

/** ترجمه برای متن‌هایی که Main می‌سازه (CSV و دیالوگ) */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface SaveTextOptions {
  title: string;
  defaultName: string;
  filterName: string;
  extension: string;
  content: string;
}

/** ذخیره‌ی فایل متنی با دیالوگ؛ مسیر ذخیره یا null اگه کاربر لغو کرد */
export interface FileSaver {
  saveText(options: SaveTextOptions): Promise<string | null>;
}
