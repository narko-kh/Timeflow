/*
 * آیکون tray
 * -----------
 * منو: نمایش / شروع-توقف (با اسم آخرین پروژه) / خروج
 * tooltip: پروژه‌ی فعال و زمان سپری‌شده.
 * macOS: آیکون template تک‌رنگ ۴۴ پیکسل با scaleFactor: 2.
 * روی بعضی لینوکس‌ها tray وجود نداره؛ در اون صورت available=false می‌مونه.
 */
import { formatClock } from '@shared/format';
import type { TimerState } from '@shared/types';
import { Menu, Tray, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { Translate } from '../services/ports';

export interface TrayDeps {
  assetsDir: string;
  platform: NodeJS.Platform;
  t: Translate;
  getState(): TimerState;
  /** اسم پروژه‌ای که تایمر روش در حال اجراست یا آخرین پروژه‌ی استفاده‌شده */
  getProjectName(projectId: string | null): Promise<string | null>;
  now(): number;
  onShow(): void;
  onToggle(): void;
  onQuit(): void;
}

export class TrayController {
  private tray: Tray | null = null;
  private lastProjectName: string | null = null;

  constructor(private readonly deps: TrayDeps) {}

  get available(): boolean {
    return this.tray !== null && !this.tray.isDestroyed();
  }

  create(): void {
    try {
      const { assetsDir, platform } = this.deps;
      let image;
      if (platform === 'darwin') {
        // ۴۴ پیکسل با scaleFactor 2 یعنی ۲۲ نقطه‌ی منطقی (اندازه‌ی استاندارد نوار منو)
        image = nativeImage.createFromBuffer(
          fs.readFileSync(path.join(assetsDir, 'trayTemplate.png')),
          { scaleFactor: 2 },
        );
        image.setTemplateImage(true);
      } else {
        image = nativeImage.createFromPath(path.join(assetsDir, 'tray.png'));
      }
      this.tray = new Tray(image);
      this.tray.on('click', () => this.deps.onShow());
      void this.refresh();
    } catch {
      // محیط بدون tray (مثلاً بعضی دسکتاپ‌های لینوکس)
      this.tray = null;
    }
  }

  /** بازسازی منو و tooltip بر اساس وضعیت فعلی (زبان یا تایمر که عوض شد صدا بزن) */
  async refresh(): Promise<void> {
    if (!this.tray || this.tray.isDestroyed()) return;
    const { t, getState } = this.deps;
    const state = getState();
    const running = state.active !== null;
    const name = await this.deps.getProjectName(state.active?.projectId ?? null);
    if (name) this.lastProjectName = name;

    const toggleLabel = running
      ? t('tray.stop')
      : this.lastProjectName
        ? t('tray.startProject', { project: this.lastProjectName })
        : t('tray.start');

    const menu = Menu.buildFromTemplate([
      { label: t('tray.show'), click: () => this.deps.onShow() },
      { label: toggleLabel, click: () => this.deps.onToggle() },
      { type: 'separator' },
      { label: t('tray.quit'), click: () => this.deps.onQuit() },
    ]);
    this.tray.setContextMenu(menu);

    if (running && state.active) {
      const secs = (this.deps.now() - Date.parse(state.active.startedAt)) / 1000;
      this.tray.setToolTip(
        t('tray.tooltipRunning', { project: name ?? '', time: formatClock(secs) }),
      );
    } else {
      this.tray.setToolTip(t('tray.tooltipIdle'));
    }
  }

  destroy(): void {
    if (this.tray && !this.tray.isDestroyed()) this.tray.destroy();
    this.tray = null;
  }
}
