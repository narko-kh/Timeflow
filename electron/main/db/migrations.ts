/*
 * مهاجرت‌های دیتابیس
 * -------------------
 * هر مهاجرت یک id یکتا داره و فقط یک بار، داخل یک تراکنش اجرا می‌شه.
 * وضعیت اجرا تو جدول schema_migrations نگه داشته می‌شه، پس دوباره اجرا کردن بی‌خطره.
 * مهاجرت‌ها رو هیچ‌وقت دستکاری نکن؛ تغییر جدید = مهاجرت جدید.
 */
import type { Database } from './client';

export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '001_init',
    sql: `
      CREATE TABLE projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        client text NOT NULL DEFAULT '',
        color text NOT NULL,
        hourly_rate_cents integer,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE time_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        description text NOT NULL DEFAULT '',
        started_at timestamptz NOT NULL,
        ended_at timestamptz,
        source text NOT NULL CHECK (source IN ('timer','manual','pomodoro')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (ended_at IS NULL OR ended_at >= started_at)
      );
      CREATE INDEX time_entries_started_at_idx ON time_entries (started_at);
      CREATE INDEX time_entries_project_idx ON time_entries (project_id);
      -- حداکثر یک تایمر فعال (ثبتی که ended_at ندارد)
      CREATE UNIQUE INDEX one_active_entry ON time_entries ((true)) WHERE ended_at IS NULL;

      CREATE TABLE settings (key text PRIMARY KEY, value jsonb NOT NULL);
    `,
  },
];

/** همه‌ی مهاجرت‌های اجرا‌نشده رو به ترتیب اجرا می‌کنه و تعداد اجراشده‌ها رو برمی‌گردونه */
export async function runMigrations(
  db: Database,
  migrations: Migration[] = MIGRATIONS,
): Promise<number> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const done = await db.query<{ id: string }>('SELECT id FROM schema_migrations');
  const applied = new Set(done.rows.map((r) => r.id));
  let count = 0;

  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    await db.exec('BEGIN');
    try {
      await db.exec(m.sql);
      await db.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id]);
      await db.exec('COMMIT');
      count++;
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  }
  return count;
}
