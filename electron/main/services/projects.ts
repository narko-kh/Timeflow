/*
 * سرویس پروژه‌ها
 * ---------------
 * ساخت، ویرایش، بایگانی و حذف. قانون مهم: اگه تایمر روی یک پروژه در حال اجراست،
 * قبل از حذف/بایگانی اون پروژه تایمر اول متوقف می‌شه.
 */
import { earningsCents } from '@shared/format';
import type { Project, ProjectWithStats } from '@shared/types';
import { parseId, parseProjectInput } from '@shared/validation';
import { AppError } from '../errors';
import type { ProjectsRepo } from '../repositories/projects';
import type { Clock } from './ports';
import type { TimerService } from './timer';

export class ProjectsService {
  constructor(
    private readonly repo: ProjectsRepo,
    private readonly timer: TimerService,
    private readonly clock: Clock,
  ) {}

  /** همه‌ی پروژه‌ها (فعال و بایگانی‌شده) با آمار کل و این ماه */
  async list(): Promise<ProjectWithStats[]> {
    const now = new Date(this.clock());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const rows = await this.repo.listWithStats(
      monthStart.toISOString(),
      now.toISOString(),
      monthEnd.toISOString(),
    );
    return rows.map((r) => ({
      ...r,
      monthEarningsCents: earningsCents(r.monthSeconds, r.hourlyRateCents),
    }));
  }

  async create(input: unknown): Promise<Project> {
    const parsed = parseProjectInput(input);
    if (!parsed.ok) throw new AppError(parsed.code);
    return this.repo.insert(parsed.value);
  }

  async update(id: unknown, input: unknown): Promise<Project> {
    const pid = parseId(id);
    if (!pid.ok) throw new AppError('project_invalid');
    const parsed = parseProjectInput(input);
    if (!parsed.ok) throw new AppError(parsed.code);
    const updated = await this.repo.update(pid.value, parsed.value);
    if (!updated) throw new AppError('project_not_found');
    // اگه پروژه‌ی در حال اجراست، نام و رنگش تو UI تازه می‌شه (state دوباره منتشر می‌شه)
    await this.timer.refreshActive();
    return updated;
  }

  async setArchived(id: unknown, archived: unknown): Promise<Project> {
    const pid = parseId(id);
    if (!pid.ok) throw new AppError('project_invalid');
    if (typeof archived !== 'boolean') throw new AppError('settings_invalid');
    if (archived) await this.timer.stopIfProject(pid.value);
    const updated = await this.repo.setArchived(
      pid.value,
      archived ? new Date(this.clock()).toISOString() : null,
    );
    if (!updated) throw new AppError('project_not_found');
    return updated;
  }

  async remove(id: unknown): Promise<void> {
    const pid = parseId(id);
    if (!pid.ok) throw new AppError('project_invalid');
    await this.timer.stopIfProject(pid.value);
    const removed = await this.repo.remove(pid.value);
    if (!removed) throw new AppError('project_not_found');
  }
}
