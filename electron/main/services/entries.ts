/*
 * سرویس ثبت‌های زمان
 * -------------------
 * لیست روزانه، ثبت دستی، ویرایش و حذف.
 * قانون‌ها:
 *  - ثبت فعال: فقط پروژه و توضیحش قابل ویرایشه (زمانش نه)
 *  - ثبت دستی نباید تو آینده تموم بشه و باید حداقل ۱ ثانیه باشه
 *  - ثبت روی پروژه‌ی بایگانی‌شده/ناشناخته رد می‌شه
 */
import { dayStart, nextDayStart } from '@shared/time';
import type { TimeEntry } from '@shared/types';
import { parseEntryQuery, parseEntryUpdate, parseId, parseManualEntry } from '@shared/validation';
import { AppError } from '../errors';
import type { EntriesRepo, EntryPatch } from '../repositories/entries';
import type { ProjectsRepo } from '../repositories/projects';
import type { Clock } from './ports';
import type { TimerService } from './timer';

const MIN_MS = 1000;

export class EntriesService {
  constructor(
    private readonly entries: EntriesRepo,
    private readonly projects: ProjectsRepo,
    private readonly timer: TimerService,
    private readonly clock: Clock,
  ) {}

  /** ثبت‌هایی که با بازه‌ی روزهای محلی هم‌پوشانی دارن */
  async list(query: unknown): Promise<TimeEntry[]> {
    const parsed = parseEntryQuery(query);
    if (!parsed.ok) throw new AppError(parsed.code);
    const { from, to, projectId } = parsed.value;
    return this.entries.listOverlapping(
      dayStart(from).toISOString(),
      nextDayStart(to).toISOString(),
      projectId,
    );
  }

  async create(input: unknown): Promise<TimeEntry> {
    const parsed = parseManualEntry(input);
    if (!parsed.ok) throw new AppError(parsed.code);
    const v = parsed.value;
    const start = Date.parse(v.startedAt);
    const end = Date.parse(v.endedAt);
    if (end - start < MIN_MS) throw new AppError('end_before_start');
    if (end > this.clock()) throw new AppError('end_in_future');
    await this.assertUsableProject(v.projectId);
    return this.entries.insert({
      projectId: v.projectId,
      description: v.description,
      startedAt: v.startedAt,
      endedAt: v.endedAt,
      source: 'manual',
    });
  }

  async update(input: unknown): Promise<TimeEntry> {
    const parsed = parseEntryUpdate(input);
    if (!parsed.ok) throw new AppError(parsed.code);
    const patch = parsed.value;
    const current = await this.entries.get(patch.id);
    if (!current) throw new AppError('entry_not_found');

    const isActive = current.endedAt === null;
    if (isActive && (patch.startedAt !== undefined || patch.endedAt !== undefined)) {
      throw new AppError('entry_active');
    }
    if (patch.projectId !== undefined && patch.projectId !== current.projectId) {
      await this.assertUsableProject(patch.projectId);
    }

    if (!isActive) {
      const start = Date.parse(patch.startedAt ?? current.startedAt);
      const end = Date.parse(patch.endedAt ?? (current.endedAt as string));
      if (end - start < MIN_MS) throw new AppError('end_before_start');
      if (end > this.clock()) throw new AppError('end_in_future');
    }

    const repoPatch: EntryPatch = {
      projectId: patch.projectId,
      description: patch.description,
      startedAt: patch.startedAt,
      endedAt: patch.endedAt,
    };
    const updated = await this.entries.update(patch.id, repoPatch);
    if (!updated) throw new AppError('entry_not_found');
    if (isActive) await this.timer.refreshActive();
    return updated;
  }

  async remove(id: unknown): Promise<void> {
    const parsed = parseId(id);
    if (!parsed.ok) throw new AppError(parsed.code);
    const state = this.timer.getState();
    if (state.active?.entryId === parsed.value) {
      await this.timer.discardActive();
      return;
    }
    const removed = await this.entries.remove(parsed.value);
    if (!removed) throw new AppError('entry_not_found');
  }

  private async assertUsableProject(projectId: string): Promise<void> {
    const project = await this.projects.get(projectId);
    if (!project) throw new AppError('project_invalid');
    if (project.archivedAt) throw new AppError('project_archived');
  }
}
