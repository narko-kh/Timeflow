/*
 * هندلرهای IPC
 * -------------
 * هر هندلر:
 *  ۱. مطمئن می‌شه فرستنده صفحه‌ی خود برنامه‌ست
 *  ۲. صبر می‌کنه دیتابیس آماده بشه
 *  ۳. کار رو به سرویس می‌سپاره (اعتبارسنجی ورودی تو سرویس‌ها انجام می‌شه)
 *  ۴. خروجی رو به شکل { ok, data } یا { ok:false, code } برمی‌گردونه
 * خطای داخلی هیچ‌وقت به صفحه نمی‌رسه؛ فقط کد 'internal'.
 */
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { Channels } from '@shared/channels';
import type { Result, SystemInfo } from '@shared/types';
import { parseStartInput } from '@shared/validation';
import { AppError } from '../errors';
import { isTrustedSender } from '../platform/security';
import type { EntriesService } from '../services/entries';
import type { ProjectsService } from '../services/projects';
import type { ReportsService } from '../services/reports';
import type { SettingsService } from '../services/settings';
import type { TimerService } from '../services/timer';

export interface IpcServices {
  projects: ProjectsService;
  entries: EntriesService;
  timer: TimerService;
  reports: ReportsService;
  settings: SettingsService;
  getSystemInfo(): SystemInfo;
}

export interface IpcOptions {
  ready: Promise<IpcServices>;
  devUrl: string | undefined;
  onError(err: unknown): void;
}

export function registerIpc({ ready, devUrl, onError }: IpcOptions): void {
  /** پوشش مشترک همه‌ی هندلرها */
  const handle = <T>(
    channel: string,
    fn: (services: IpcServices, arg: unknown) => Promise<T> | T,
  ): void => {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, arg: unknown): Promise<Result<T>> => {
      if (!isTrustedSender(event.senderFrame?.url, devUrl)) {
        return { ok: false, code: 'forbidden' };
      }
      try {
        const services = await ready;
        return { ok: true, data: await fn(services, arg) };
      } catch (err) {
        if (err instanceof AppError) return { ok: false, code: err.code };
        onError(err);
        return { ok: false, code: 'internal' };
      }
    });
  };

  const asRecord = (v: unknown): Record<string, unknown> =>
    typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

  // ----- پروژه‌ها -----
  handle(Channels.projectsList, (s) => s.projects.list());
  handle(Channels.projectsCreate, (s, arg) => s.projects.create(arg));
  handle(Channels.projectsUpdate, (s, arg) => {
    const a = asRecord(arg);
    return s.projects.update(a.id, a.input);
  });
  handle(Channels.projectsSetArchived, (s, arg) => {
    const a = asRecord(arg);
    return s.projects.setArchived(a.id, a.archived);
  });
  handle(Channels.projectsRemove, async (s, arg) => {
    await s.projects.remove(arg);
    return null;
  });

  // ----- ثبت‌ها -----
  handle(Channels.entriesList, (s, arg) => s.entries.list(arg));
  handle(Channels.entriesCreate, (s, arg) => s.entries.create(arg));
  handle(Channels.entriesUpdate, (s, arg) => s.entries.update(arg));
  handle(Channels.entriesRemove, async (s, arg) => {
    await s.entries.remove(arg);
    return null;
  });

  // ----- تایمر -----
  handle(Channels.timerGet, (s) => s.timer.getState());
  handle(Channels.timerStart, (s, arg) => {
    const parsed = parseStartInput(arg);
    if (!parsed.ok) throw new AppError(parsed.code);
    return s.timer.start(parsed.value);
  });
  handle(Channels.timerStop, (s) => s.timer.stop());
  handle(Channels.timerToggleLast, (s) => s.timer.toggleLast());
  handle(Channels.timerSetPomodoro, (s, arg) => {
    if (typeof arg !== 'boolean') throw new AppError('settings_invalid');
    return s.timer.setPomodoro(arg);
  });
  handle(Channels.timerSkipBreak, (s) => s.timer.skipBreak());

  // ----- گزارش -----
  handle(Channels.reportsGet, (s, arg) => s.reports.get(arg));
  handle(Channels.reportsExportCsv, (s, arg) => s.reports.exportCsv(arg));

  // ----- تنظیمات و سیستم -----
  handle(Channels.settingsGet, (s) => s.settings.get());
  handle(Channels.settingsUpdate, (s, arg) => s.settings.update(arg));
  handle(Channels.systemInfo, (s) => s.getSystemInfo());
}
