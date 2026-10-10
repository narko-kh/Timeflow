/*
 * ریپازیتوری ثبت‌های زمان
 * ------------------------
 * فقط SQL پارامتری. قانون «حداکثر یک ثبت فعال» با یک ایندکس یکتای جزئی
 * تو خود دیتابیس هم تضمین شده (one_active_entry).
 */
import { toIso, toIsoOrNull, type Queryable } from '../db/client';
import type { EntrySource, TimeEntry } from '@shared/types';

interface EntryRow {
  id: string;
  project_id: string;
  description: string;
  started_at: unknown;
  ended_at: unknown;
  source: EntrySource;
}

const COLUMNS = 'id, project_id, description, started_at, ended_at, source';

const map = (r: EntryRow): TimeEntry => ({
  id: r.id,
  projectId: r.project_id,
  description: r.description,
  startedAt: toIso(r.started_at),
  endedAt: toIsoOrNull(r.ended_at),
  source: r.source,
});

export interface NewEntry {
  projectId: string;
  description: string;
  startedAt: string;
  endedAt: string | null;
  source: EntrySource;
}

export interface EntryPatch {
  projectId?: string;
  description?: string;
  startedAt?: string;
  endedAt?: string;
}

/** allow-list ستون‌های قابل ویرایش */
const UPDATABLE: Record<keyof EntryPatch, string> = {
  projectId: 'project_id',
  description: 'description',
  startedAt: 'started_at',
  endedAt: 'ended_at',
};

export class EntriesRepo {
  constructor(private readonly db: Queryable) {}

  async get(id: string, q: Queryable = this.db): Promise<TimeEntry | null> {
    const res = await q.query<EntryRow>(`SELECT ${COLUMNS} FROM time_entries WHERE id = $1`, [id]);
    const row = res.rows[0];
    return row ? map(row) : null;
  }

  async getActive(q: Queryable = this.db): Promise<TimeEntry | null> {
    const res = await q.query<EntryRow>(
      `SELECT ${COLUMNS} FROM time_entries WHERE ended_at IS NULL LIMIT 1`,
    );
    const row = res.rows[0];
    return row ? map(row) : null;
  }

  /** جدیدترین ثبت (برای toggleLast) */
  async getLast(q: Queryable = this.db): Promise<TimeEntry | null> {
    const res = await q.query<EntryRow>(
      `SELECT ${COLUMNS} FROM time_entries ORDER BY started_at DESC, created_at DESC LIMIT 1`,
    );
    const row = res.rows[0];
    return row ? map(row) : null;
  }

  /**
   * ثبت‌هایی که با بازه‌ی [fromIso, toIso) هم‌پوشانی دارن (ثبت فعال هم هست).
   * ordering: جدیدترین اول.
   */
  async listOverlapping(
    fromIso: string,
    toIso_: string,
    projectId?: string,
    q: Queryable = this.db,
  ): Promise<TimeEntry[]> {
    const params: unknown[] = [fromIso, toIso_];
    let filter = '';
    if (projectId) {
      params.push(projectId);
      filter = ` AND project_id = $${params.length}`;
    }
    const res = await q.query<EntryRow>(
      `SELECT ${COLUMNS} FROM time_entries
        WHERE started_at < $2::timestamptz
          AND (ended_at IS NULL OR ended_at > $1::timestamptz)${filter}
        ORDER BY started_at DESC, created_at DESC`,
      params,
    );
    return res.rows.map(map);
  }

  async insert(input: NewEntry, q: Queryable = this.db): Promise<TimeEntry> {
    const res = await q.query<EntryRow>(
      `INSERT INTO time_entries (project_id, description, started_at, ended_at, source)
       VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5) RETURNING ${COLUMNS}`,
      [input.projectId, input.description, input.startedAt, input.endedAt, input.source],
    );
    return map(res.rows[0] as EntryRow);
  }

  async update(id: string, patch: EntryPatch, q: Queryable = this.db): Promise<TimeEntry | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of Object.keys(UPDATABLE) as Array<keyof EntryPatch>) {
      if (patch[key] === undefined) continue;
      params.push(patch[key]);
      sets.push(`${UPDATABLE[key]} = $${params.length}`);
    }
    if (sets.length === 0) return this.get(id, q);
    sets.push('updated_at = now()');
    params.push(id);
    const res = await q.query<EntryRow>(
      `UPDATE time_entries SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${COLUMNS}`,
      params,
    );
    const row = res.rows[0];
    return row ? map(row) : null;
  }

  /** بستن ثبت فعال در لحظه‌ی endedAt */
  async close(id: string, endedAtIso: string, q: Queryable = this.db): Promise<void> {
    await q.query(
      `UPDATE time_entries SET ended_at = $1::timestamptz, updated_at = now() WHERE id = $2`,
      [endedAtIso, id],
    );
  }

  async remove(id: string, q: Queryable = this.db): Promise<boolean> {
    const res = await q.query<{ id: string }>('DELETE FROM time_entries WHERE id = $1 RETURNING id', [id]);
    return res.rows.length > 0;
  }
}
