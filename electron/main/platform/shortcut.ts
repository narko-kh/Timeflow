/*
 * میان‌بر سراسری
 * ---------------
 * CommandOrControl+Alt+T → شروع/توقف آخرین پروژه.
 * ممکنه ثبت نشه (برنامه‌ی دیگه گرفته یا Wayland اجازه نمی‌ده)؛
 * وضعیت registered برای نمایش تو تنظیمات نگه داشته می‌شه.
 */
import { globalShortcut } from 'electron';

export const SHORTCUT_ACCELERATOR = 'CommandOrControl+Alt+T';

export class ShortcutManager {
  private registered = false;

  constructor(private readonly onTrigger: () => void) {}

  get isRegistered(): boolean {
    return this.registered;
  }

  /** ثبت یا حذف بر اساس تنظیم کاربر */
  apply(enabled: boolean): void {
    this.unregister();
    if (!enabled) return;
    try {
      this.registered = globalShortcut.register(SHORTCUT_ACCELERATOR, this.onTrigger);
    } catch {
      this.registered = false;
    }
  }

  unregister(): void {
    if (this.registered) globalShortcut.unregister(SHORTCUT_ACCELERATOR);
    this.registered = false;
  }
}
