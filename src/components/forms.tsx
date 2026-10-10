'use client';
/*
 * فرم‌های مودال: پروژه و ثبت زمان
 * --------------------------------
 * اعتبارسنجی نهایی تو Main انجام می‌شه؛ اینجا فقط تجربه‌ی کاربری رو بهتر می‌کنیم.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toDayString } from '@shared/time';
import type { ProjectWithStats, TimeEntry } from '@shared/types';
import { localToIso, toTimeInput } from '@/lib/intl';
import { useApp } from '@/stores/app';
import { Modal } from './Modal';

export const PROJECT_COLORS = [
  '#0e9f8e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#84cc16',
  '#64748b',
];

// ---------------- پروژه ----------------

interface ProjectFormProps {
  project?: ProjectWithStats;
  onClose(): void;
}

export function ProjectFormModal({ project, onClose }: ProjectFormProps) {
  const { t } = useTranslation();
  const run = useApp((s) => s.run);
  const refresh = useApp((s) => s.refreshProjects);
  const [name, setName] = useState(project?.name ?? '');
  const [client, setClient] = useState(project?.client ?? '');
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0] ?? '#0e9f8e');
  const [rate, setRate] = useState(
    project?.hourlyRateCents != null ? String(project.hourlyRateCents / 100) : '',
  );
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const api = window.api;
    if (!api || busy) return;
    const trimmed = rate.trim();
    // ورودی نرخ به واحد اصلی (مثل دلار) می‌گیریم و به سنت تبدیل می‌کنیم
    const parsed = trimmed === '' ? null : Math.round(Number(trimmed.replace(',', '.')) * 100);
    const hourlyRateCents = parsed !== null && Number.isFinite(parsed) ? parsed : trimmed === '' ? null : -1;
    const input = { name, client, color, hourlyRateCents };
    setBusy(true);
    const res = await run(
      project ? api.projects.update(project.id, input) : api.projects.create(input),
    );
    setBusy(false);
    if (res) {
      await refresh();
      onClose();
    }
  };

  return (
    <Modal
      title={project ? t('projects.edit') : t('projects.new')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="project-form" className="btn btn-primary" disabled={busy}>
            {project ? t('common.save') : t('common.create')}
          </button>
        </>
      }
    >
      <form id="project-form" className="form" onSubmit={submit}>
        <label className="field">
          <span>{t('projects.name')}</span>
          <input
            className="input"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>
            {t('projects.client')} <em className="muted">({t('common.optional')})</em>
          </span>
          <input
            className="input"
            value={client}
            maxLength={80}
            onChange={(e) => setClient(e.target.value)}
          />
        </label>
        <div className="field">
          <span id="color-label">{t('projects.color')}</span>
          <div className="swatches" role="radiogroup" aria-labelledby="color-label">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                className={`swatch${color === c ? ' is-selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <label className="field">
          <span>
            {t('projects.hourlyRate')} <em className="muted">({t('common.optional')})</em>
          </span>
          <input
            className="input"
            inputMode="decimal"
            value={rate}
            placeholder="0.00"
            dir="ltr"
            onChange={(e) => setRate(e.target.value)}
          />
          <small className="muted">{t('projects.hourlyRateHint')}</small>
        </label>
      </form>
    </Modal>
  );
}

// ---------------- ثبت زمان ----------------

interface EntryFormProps {
  /** اگه داده بشه ویرایش است، وگرنه ثبت دستی جدید */
  entry?: TimeEntry;
  defaultProjectId?: string;
  onClose(): void;
}

export function EntryFormModal({ entry, defaultProjectId, onClose }: EntryFormProps) {
  const { t } = useTranslation();
  const run = useApp((s) => s.run);
  const projects = useApp((s) => s.projects);
  const refresh = useApp((s) => s.refreshProjects);
  const isActive = entry !== undefined && entry.endedAt === null;

  const now = new Date();
  const startDate = entry ? new Date(entry.startedAt) : new Date(now.getTime() - 3600_000);
  const endDate = entry?.endedAt ? new Date(entry.endedAt) : now;

  const usable = projects.filter((p) => !p.archivedAt || p.id === entry?.projectId);
  const [projectId, setProjectId] = useState(
    entry?.projectId ?? defaultProjectId ?? usable[0]?.id ?? '',
  );
  const [description, setDescription] = useState(entry?.description ?? '');
  const [day, setDay] = useState(toDayString(startDate));
  const [start, setStart] = useState(toTimeInput(startDate));
  const [end, setEnd] = useState(toTimeInput(endDate));
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const api = window.api;
    if (!api || busy) return;
    setBusy(true);
    let res: unknown;
    if (entry && isActive) {
      res = await run(api.entries.update({ id: entry.id, projectId, description }));
    } else if (entry) {
      // پایان ممکنه به روز بعد بیفته (مثلاً ۲۳:۰۰ تا ۰۱:۰۰)
      const startedAt = localToIso(day, start);
      let endedAt = localToIso(day, end);
      if (Date.parse(endedAt) <= Date.parse(startedAt)) {
        endedAt = new Date(Date.parse(endedAt) + 86_400_000).toISOString();
      }
      res = await run(api.entries.update({ id: entry.id, projectId, description, startedAt, endedAt }));
    } else {
      const startedAt = localToIso(day, start);
      let endedAt = localToIso(day, end);
      if (Date.parse(endedAt) <= Date.parse(startedAt)) {
        endedAt = new Date(Date.parse(endedAt) + 86_400_000).toISOString();
      }
      res = await run(api.entries.create({ projectId, description, startedAt, endedAt }));
    }
    setBusy(false);
    if (res) {
      await refresh();
      onClose();
    }
  };

  return (
    <Modal
      title={entry ? t('timer.editEntry') : t('timer.manualTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="entry-form" className="btn btn-primary" disabled={busy || !projectId}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="entry-form" className="form" onSubmit={submit}>
        <label className="field">
          <span>{t('timer.project')}</span>
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            {usable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('timer.description')}</span>
          <input
            className="input"
            value={description}
            maxLength={280}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {!isActive && (
          <div className="field-row">
            <label className="field">
              <span>{t('timer.date')}</span>
              <input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
            </label>
            <label className="field">
              <span>{t('timer.startTime')}</span>
              <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label className="field">
              <span>{t('timer.endTime')}</span>
              <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
}
