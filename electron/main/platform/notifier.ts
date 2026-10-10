/*
 * اعلان‌های سیستم‌عامل
 * ---------------------
 * پیاده‌سازی Notifier با Notification الکترون. متن‌ها از i18n میان
 * و با تغییر زبان خودکار به‌روز می‌شن (چون t هر بار صدا زده می‌شه).
 */
import { Notification } from 'electron';
import type { AppNotification, Notifier, Translate } from '../services/ports';

export class DesktopNotifier implements Notifier {
  constructor(
    private readonly t: Translate,
    private readonly onClick: () => void,
  ) {}

  notify(n: AppNotification): void {
    if (!Notification.isSupported()) return;
    const { title, body } = this.content(n);
    const note = new Notification({ title, body, silent: false });
    note.on('click', () => this.onClick());
    note.show();
  }

  private content(n: AppNotification): { title: string; body: string } {
    const { t } = this;
    switch (n.kind) {
      case 'recovered':
        return { title: t('notify.recoveredTitle'), body: t('notify.recoveredBody') };
      case 'idleStopped':
        return {
          title: t('notify.idleTitle'),
          body: t('notify.idleBody', { minutes: n.minutes }),
        };
      case 'workDone':
        return {
          title: t('notify.workDoneTitle'),
          body: t('notify.workDoneBody', { minutes: n.breakMinutes }),
        };
      case 'breakDone':
        return { title: t('notify.breakDoneTitle'), body: t('notify.breakDoneBody') };
    }
  }
}
