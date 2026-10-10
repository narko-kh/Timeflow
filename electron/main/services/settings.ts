/*
 * سرویس تنظیمات
 * --------------
 * تنظیمات رو از دیتابیس می‌خونه، با پیش‌فرض‌ها ادغام می‌کنه (مقدار خراب = پیش‌فرض)
 * و هر تغییر رو به شنونده‌ها خبر می‌ده. مقدارها فقط بعد از اعتبارسنجی ذخیره می‌شن.
 */
import { defaultSettings } from '@shared/settings';
import type { Settings, SettingsPatch } from '@shared/types';
import { parseSettingsPatch } from '@shared/validation';
import { AppError } from '../errors';
import type { SettingsRepo } from '../repositories/settings';

export type SettingsListener = (settings: Settings) => void;

export class SettingsService {
  private current: Settings;
  private readonly listeners = new Set<SettingsListener>();

  constructor(
    private readonly repo: SettingsRepo,
    private readonly platform: string,
  ) {
    this.current = defaultSettings(platform);
  }

  /** بارگذاری از دیتابیس؛ مقدارهای نامعتبر نادیده گرفته می‌شن */
  async load(): Promise<Settings> {
    const stored = await this.repo.getAll();
    const merged: Record<string, unknown> = { ...defaultSettings(this.platform) };
    for (const [key, value] of Object.entries(stored)) {
      const check = parseSettingsPatch({ [key]: value });
      if (check.ok) merged[key] = value;
    }
    this.current = merged as unknown as Settings;
    return this.current;
  }

  get(): Settings {
    return this.current;
  }

  async update(patch: unknown): Promise<Settings> {
    const parsed = parseSettingsPatch(patch);
    if (!parsed.ok) throw new AppError(parsed.code);
    const value: SettingsPatch = parsed.value;
    for (const [key, v] of Object.entries(value)) {
      await this.repo.set(key, v);
    }
    this.current = { ...this.current, ...value };
    for (const l of this.listeners) l(this.current);
    return this.current;
  }

  onChange(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
