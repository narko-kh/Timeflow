/*
 * ریپازیتوری تنظیمات (key/value روی jsonb)
 * ------------------------------------------
 * مقدارهای کمکی داخلی (مثل آخرین ضربان) با پیشوند meta. تو همین جدول ذخیره می‌شن
 * و تو لیست تنظیماتِ کاربر نمیان.
 */
import type { Queryable } from '../db/client';

export class SettingsRepo {
  constructor(private readonly db: Queryable) {}

  /** همه‌ی تنظیمات کاربر (بدون meta.) */
  async getAll(q: Queryable = this.db): Promise<Record<string, unknown>> {
    const res = await q.query<{ key: string; value: unknown }>(
      `SELECT key, value FROM settings WHERE key NOT LIKE 'meta.%'`,
    );
    const out: Record<string, unknown> = {};
    for (const r of res.rows) out[r.key] = r.value;
    return out;
  }

  async get(key: string, q: Queryable = this.db): Promise<unknown | undefined> {
    const res = await q.query<{ value: unknown }>('SELECT value FROM settings WHERE key = $1', [key]);
    return res.rows[0]?.value;
  }

  async set(key: string, value: unknown, q: Queryable = this.db): Promise<void> {
    await q.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)],
    );
  }
}
