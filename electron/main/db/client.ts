/*
 * کلاینت دیتابیس (PGlite)
 * ------------------------
 * PGlite یک PostgreSQL واقعیه که روی WebAssembly داخل همین پروسه‌ی Main اجرا می‌شه.
 * پس کاربر چیزی جدا نصب نمی‌کنه و هیچ پورت شبکه‌ای هم باز نمی‌شه.
 * PGlite تک‌اتصاله؛ فقط Main بهش دسترسی داره و بقیه از راه IPC حرف می‌زنن.
 */
import { PGlite } from '@electric-sql/pglite';

/** حداقلی که ریپازیتوری‌ها لازم دارن (هم دیتابیس اصلی، هم داخل تراکنش) */
export interface Queryable {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface Database extends Queryable {
  /** اجرای چند کوئری به‌صورت اتمیک؛ داخل fn فقط از tx استفاده کن */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

/**
 * باز کردن دیتابیس.
 * dir نداده بشه یعنی «در حافظه» (برای تست‌ها).
 */
export async function openDatabase(dir?: string): Promise<Database> {
  const db = dir ? await PGlite.create(dir) : await PGlite.create();
  return db as unknown as Database;
}

/** تبدیل مقدار timestamptz که PGlite به‌صورت Date میده به رشته‌ی ISO */
export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

export function toIsoOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : toIso(value);
}
