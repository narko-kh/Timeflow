/*
 * سرویس گزارش و خروجی CSV
 * ------------------------
 * داده رو از ریپازیتوری می‌گیره و به توابع خالص shared می‌ده (buildReport / buildCsv).
 * ذخیره‌ی فایل فقط از Main و با دیالوگ ذخیره انجام می‌شه.
 */
import { buildCsv } from '@shared/csv';
import { buildCsvRows, buildReport } from '@shared/report';
import { dayStart, nextDayStart } from '@shared/time';
import type { ExportCsvResult, Report } from '@shared/types';
import { parseEntryQuery } from '@shared/validation';
import { AppError } from '../errors';
import type { EntriesRepo } from '../repositories/entries';
import type { ProjectsRepo } from '../repositories/projects';
import type { Clock, FileSaver, Translate } from './ports';

export class ReportsService {
  constructor(
    private readonly entries: EntriesRepo,
    private readonly projects: ProjectsRepo,
    private readonly clock: Clock,
    private readonly files: FileSaver,
    private readonly t: Translate,
  ) {}

  async get(query: unknown): Promise<Report> {
    const q = parseEntryQuery(query);
    if (!q.ok) throw new AppError(q.code);
    const [entries, projects] = await Promise.all([
      this.entries.listOverlapping(
        dayStart(q.value.from).toISOString(),
        nextDayStart(q.value.to).toISOString(),
        q.value.projectId,
      ),
      this.projects.list(),
    ]);
    return buildReport(entries, projects, { from: q.value.from, to: q.value.to }, new Date(this.clock()));
  }

  /** ساخت CSV و ذخیره با دیالوگ؛ اگه کاربر لغو کنه saved=false برمی‌گرده */
  async exportCsv(query: unknown): Promise<ExportCsvResult> {
    const q = parseEntryQuery(query);
    if (!q.ok) throw new AppError(q.code);
    const range = { from: q.value.from, to: q.value.to };
    const [entries, projects] = await Promise.all([
      this.entries.listOverlapping(
        dayStart(range.from).toISOString(),
        nextDayStart(range.to).toISOString(),
        q.value.projectId,
      ),
      this.projects.list(),
    ]);
    const rows = buildCsvRows(entries, projects, range, new Date(this.clock()));
    const content = buildCsv(rows, {
      date: this.t('csv.date'),
      start: this.t('csv.start'),
      end: this.t('csv.end'),
      duration: this.t('csv.duration'),
      hours: this.t('csv.hours'),
      project: this.t('csv.project'),
      client: this.t('csv.client'),
      description: this.t('csv.description'),
      rate: this.t('csv.rate'),
      amount: this.t('csv.amount'),
    });
    const base = this.t('dialog.defaultFileName');
    const path = await this.files.saveText({
      title: this.t('dialog.saveCsvTitle'),
      defaultName: `${base}-${range.from}_${range.to}.csv`,
      filterName: this.t('dialog.csvFilter'),
      extension: 'csv',
      content,
    });
    return path ? { saved: true, path } : { saved: false };
  }
}
