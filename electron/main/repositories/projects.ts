/*
 * ریپازیتوری پروژه‌ها
 * --------------------
 * فقط SQL اینجاست (کاملاً پارامتری) و هیچ قانون کسب‌وکاری نداره.
 * نام ستون‌های UPDATE فقط از allow-list ثابت میان؛ مقدارها همیشه $1، $2، ...
 */
import { toIso, toIsoOrNull, type Queryable } from '../db/client';
import type { Project, ProjectInput } from '@shared/types';

interface ProjectRow {
  id: string;
  name: string;
  client: string;
  color: string;
  hourly_rate_cents: number | null;
  archived_at: unknown;
  created_at: unknown;
}

export interface ProjectStatsRow extends Project {
  totalSeconds: number;
  monthSeconds: number;
}

const COLUMNS = 'id, name, client, color, hourly_rate_cents, archived_at, created_at';

const map = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  client: r.client,
  color: r.color,
  hourlyRateCents: r.hourly_rate_cents,
  archivedAt: toIsoOrNull(r.archived_at),
  createdAt: toIso(r.created_at),
});

/** allow-list ستون‌های قابل ویرایش (کلید JS → نام ستون) */
const UPDATABLE: Record<keyof ProjectInput, string> = {
  name: 'name',
  client: 'client',
  color: 'color',
  hourlyRateCents: 'hourly_rate_cents',
};

export class ProjectsRepo {
  constructor(private readonly db: Queryable) {}

  async list(q: Queryable = this.db): Promise<Project[]> {
    const res = await q.query<ProjectRow>(
      `SELECT ${COLUMNS} FROM projects ORDER BY archived_at IS NOT NULL, lower(name), created_at`,
    );
    return res.rows.map(map);
  }

  async get(id: string, q: Queryable = this.db): Promise<Project | null> {
    const res = await q.query<ProjectRow>(`SELECT ${COLUMNS} FROM projects WHERE id = $1`, [id]);
    const row = res.rows[0];
    return row ? map(row) : null;
  }

  async insert(input: ProjectInput, q: Queryable = this.db): Promise<Project> {
    const res = await q.query<ProjectRow>(
      `INSERT INTO projects (name, client, color, hourly_rate_cents)
       VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [input.name, input.client, input.color, input.hourlyRateCents],
    );
    return map(res.rows[0] as ProjectRow);
  }

  async update(id: string, patch: Partial<ProjectInput>, q: Queryable = this.db): Promise<Project | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of Object.keys(UPDATABLE) as Array<keyof ProjectInput>) {
      if (patch[key] === undefined) continue;
      params.push(patch[key]);
      sets.push(`${UPDATABLE[key]} = $${params.length}`);
    }
    if (sets.length === 0) return this.get(id, q);
    params.push(id);
    const res = await q.query<ProjectRow>(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${COLUMNS}`,
      params,
    );
    const row = res.rows[0];
    return row ? map(row) : null;
  }

  async setArchived(id: string, archivedAt: string | null, q: Queryable = this.db): Promise<Project | null> {
    const res = await q.query<ProjectRow>(
      `UPDATE projects SET archived_at = $1 WHERE id = $2 RETURNING ${COLUMNS}`,
      [archivedAt, id],
    );
    const row = res.rows[0];
    return row ? map(row) : null;
  }

  async remove(id: string, q: Queryable = this.db): Promise<boolean> {
    const res = await q.query<{ id: string }>('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
    return res.rows.length > 0;
  }

  /**
   * لیست پروژه‌ها همراه جمع زمان «کل» و «این ماه».
   * ثبت فعال تا now حساب می‌شه؛ ثبت‌ها به بازه‌ی ماه بریده می‌شن.
   * همه‌ی SUMها به float8 تبدیل می‌شن تا BigInt/Numeric نیاد.
   */
  async listWithStats(
    monthStartIso: string,
    nowIso: string,
    monthEndIso: string,
    q: Queryable = this.db,
  ): Promise<ProjectStatsRow[]> {
    const res = await q.query<ProjectRow & { total_seconds: number; month_seconds: number }>(
      `SELECT p.id, p.name, p.client, p.color, p.hourly_rate_cents, p.archived_at, p.created_at,
              COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(e.ended_at, $2::timestamptz) - e.started_at))), 0)::float8
                AS total_seconds,
              COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (
                LEAST(COALESCE(e.ended_at, $2::timestamptz), $3::timestamptz)
                - GREATEST(e.started_at, $1::timestamptz)
              )))), 0)::float8 AS month_seconds
         FROM projects p
         LEFT JOIN time_entries e ON e.project_id = p.id
        GROUP BY p.id
        ORDER BY p.archived_at IS NOT NULL, lower(p.name), p.created_at`,
      [monthStartIso, nowIso, monthEndIso],
    );
    return res.rows.map((r) => ({
      ...map(r),
      totalSeconds: Math.round(Number(r.total_seconds)),
      monthSeconds: Math.round(Number(r.month_seconds)),
    }));
  }
}
