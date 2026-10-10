'use client';
/*
 * صفحه‌ی تایمر
 * -------------
 * کارت تایمر (ساعت بزرگ، پروژه، توضیح، شروع/توقف، Pomodoro)،
 * لیست ثبت‌های امروز و ثبت دستی.
 * ساعت از روی startedAt حساب می‌شه (نه شمارنده‌ی جدا) تا drift نکنه.
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatClock } from '@shared/format';
import { toDayString } from '@shared/time';
import type { TimeEntry } from '@shared/types';
import { ConfirmDialog } from '@/components/Modal';
import { EntryFormModal, ProjectFormModal } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { useNow } from '@/lib/hooks';
import { formatDuration, formatNumber, formatTimeOfDay } from '@/lib/intl';
import { useApp } from '@/stores/app';

export default function TimerPage() {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const projects = useApp((s) => s.projects);
  const timer = useApp((s) => s.timer);
  const pomodoroEnabled = useApp((s) => s.settings.pomodoroEnabled);
  const run = useApp((s) => s.run);

  const usable = useMemo(() => projects.filter((p) => !p.archivedAt), [projects]);
  const now = useNow();
  const active = timer.active;
  const pomo = timer.pomodoro;

  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [manual, setManual] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);
  const [newProject, setNewProject] = useState(false);

  // پروژه‌ی انتخابی: اگه تایمر روشنه همون، وگرنه اولین پروژه‌ی فعال
  useEffect(() => {
    if (active) {
      setProjectId(active.projectId);
      setDescription(active.description);
    } else if (!usable.some((p) => p.id === projectId)) {
      setProjectId(usable[0]?.id ?? '');
    }
  }, [active, usable, projectId]);

  const loadEntries = useCallback(async () => {
    const api = window.api;
    if (!api) return;
    const today = toDayString(new Date());
    const res = await api.entries.list({ from: today, to: today });
    if (res.ok) setEntries(res.data);
  }, []);

  // با هر تغییر وضعیت تایمر لیست امروز تازه می‌شه
  useEffect(() => {
    void loadEntries();
  }, [loadEntries, timer.active?.entryId, timer.pomodoro.phase]);

  const start = async () => {
    if (!window.api || !projectId) return;
    await run(window.api.timer.start({ projectId, description }));
  };
  const stop = async () => {
    if (!window.api) return;
    await run(window.api.timer.stop());
    setDescription('');
  };
  const switchProject = async (id: string) => {
    setProjectId(id);
    // وقتی تایمر روشنه، عوض کردن پروژه یعنی جابه‌جایی فوری
    if (active && window.api && id !== active.projectId) {
      await run(window.api.timer.start({ projectId: id, description }));
    }
  };
  const togglePomodoro = async (enabled: boolean) => {
    if (window.api) await run(window.api.timer.setPomodoro(enabled));
  };
  const skipBreak = async () => {
    if (window.api) await run(window.api.timer.skipBreak());
  };
  const confirmDelete = async () => {
    if (!deleting || !window.api) return;
    await run(window.api.entries.remove(deleting.id));
    setDeleting(null);
    void loadEntries();
  };

  const elapsed = active ? (now - Date.parse(active.startedAt)) / 1000 : 0;
  const onBreak = pomo.phase === 'shortBreak' || pomo.phase === 'longBreak';
  const phaseLeft = pomo.endsAt ? Math.max(0, (pomo.endsAt - now) / 1000) : 0;
  const phaseTotal = pomo.endsAt && pomo.startedAt ? (pomo.endsAt - pomo.startedAt) / 1000 : 1;
  const phaseProgress = pomo.phase === 'idle' ? 0 : Math.min(1, 1 - phaseLeft / phaseTotal);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const todayTotal = entries.reduce((sum, e) => {
    const end = e.endedAt ? Date.parse(e.endedAt) : now;
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    return sum + Math.max(0, end - Math.max(Date.parse(e.startedAt), startOfToday)) / 1000;
  }, 0);

  if (projects.length === 0) {
    return (
      <>
        <PageHeader title={t('timer.title')} subtitle={t('timer.subtitleIdle')} />
        <div className="empty card">
          <Icon name="folder" size={36} />
          <h2>{t('timer.noProjectsTitle')}</h2>
          <p className="muted">{t('timer.noProjectsBody')}</p>
          <button className="btn btn-primary" onClick={() => setNewProject(true)}>
            <Icon name="plus" /> {t('timer.createProject')}
          </button>
        </div>
        {newProject && <ProjectFormModal onClose={() => setNewProject(false)} />}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('timer.title')}
        subtitle={active ? t('timer.subtitleRunning') : t('timer.subtitleIdle')}
      />

      <section className="card timer-card" aria-label={t('timer.title')}>
        {onBreak ? (
          <div className="break-banner">
            <Icon name="coffee" size={26} />
            <div>
              <strong>{pomo.phase === 'longBreak' ? t('timer.longBreak') : t('timer.shortBreak')}</strong>
              <p className="muted">{t('timer.breakNoTimer')}</p>
            </div>
            <button className="btn" onClick={skipBreak}>
              <Icon name="skip" /> {t('timer.skipBreak')}
            </button>
          </div>
        ) : null}

        <div className="clock-wrap">
          <div className={`clock${active ? ' is-running' : ''}`} role="timer" aria-live="off" dir="ltr">
            {formatClock(onBreak ? phaseLeft : elapsed)}
          </div>
          {pomodoroEnabled && (
            <div className="pomo">
              <div
                className="progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(phaseProgress * 100)}
              >
                <span style={{ inlineSize: `${phaseProgress * 100}%` }} />
              </div>
              <span className="muted">
                {pomo.phase === 'work' && `${t('timer.focus')} · ${formatClock(phaseLeft)} ${t('timer.timeLeft')}`}
                {onBreak && `${pomo.phase === 'longBreak' ? t('timer.longBreak') : t('timer.shortBreak')} · ${formatClock(phaseLeft)} ${t('timer.timeLeft')}`}
                {pomo.phase === 'idle' && t('timer.pomodoroOn')}
                {' · '}
                {t('timer.sessions', { count: formatNumber(pomo.completedWork, lang) })}
              </span>
            </div>
          )}
        </div>

        <div className="timer-controls">
          <label className="field grow">
            <span className="sr-only">{t('timer.description')}</span>
            <input
              className="input input-lg"
              placeholder={t('timer.description')}
              value={description}
              maxLength={280}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !active) void start();
              }}
            />
          </label>
          <label className="field">
            <span className="sr-only">{t('timer.project')}</span>
            <select
              className="input input-lg"
              value={projectId}
              onChange={(e) => void switchProject(e.target.value)}
              aria-label={t('timer.project')}
            >
              {usable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {active ? (
            <button className="btn btn-danger btn-lg" onClick={stop}>
              <Icon name="stop" /> {t('timer.stop')}
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={start} disabled={!projectId}>
              <Icon name="play" /> {t('timer.start')}
            </button>
          )}
        </div>

        <label className="switch-row">
          <button
            type="button"
            role="switch"
            aria-checked={pomodoroEnabled}
            className={`switch${pomodoroEnabled ? ' is-on' : ''}`}
            onClick={() => void togglePomodoro(!pomodoroEnabled)}
          >
            <span className="switch-thumb" />
          </button>
          <span>{t('timer.pomodoroOn')}</span>
        </label>
      </section>

      <section className="card" aria-label={t('timer.today')}>
        <div className="card-head">
          <h2>{t('timer.today')}</h2>
          <div className="card-head-end">
            <span className="muted">
              {t('timer.todayTotal')}: <strong dir="ltr">{formatDuration(todayTotal, lang, active !== null)}</strong>
            </span>
            <button className="btn" onClick={() => setManual(true)}>
              <Icon name="plus" /> {t('timer.addManual')}
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="empty compact">
            <Icon name="clock" size={28} />
            <p>{t('timer.noEntries')}</p>
            <p className="muted">{t('timer.noEntriesHint')}</p>
          </div>
        ) : (
          <ul className="entry-list">
            {entries.map((e) => {
              const p = projectById.get(e.projectId);
              const running = e.endedAt === null;
              const secs = ((running ? now : Date.parse(e.endedAt as string)) - Date.parse(e.startedAt)) / 1000;
              return (
                <li key={e.id} className="entry">
                  <span className="dot" style={{ background: p?.color ?? 'var(--muted)' }} />
                  <div className="entry-main">
                    <strong>{p?.name ?? '—'}</strong>
                    <span className="muted">{e.description || t('timer.noDescription')}</span>
                  </div>
                  <span className="entry-range muted" dir="ltr">
                    {formatTimeOfDay(e.startedAt, lang)} – {running ? '…' : formatTimeOfDay(e.endedAt as string, lang)}
                  </span>
                  <span className={`entry-dur${running ? ' is-live' : ''}`} dir="ltr">
                    {running && <span className="live-dot" aria-label={t('timer.runningNow')} />}
                    {formatDuration(secs, lang, running)}
                  </span>
                  <div className="entry-actions">
                    <button className="icon-btn" aria-label={t('common.edit')} onClick={() => setEditing(e)}>
                      <Icon name="edit" />
                    </button>
                    <button className="icon-btn" aria-label={t('common.delete')} onClick={() => setDeleting(e)}>
                      <Icon name="trash" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {manual && (
        <EntryFormModal
          defaultProjectId={projectId}
          onClose={() => {
            setManual(false);
            void loadEntries();
          }}
        />
      )}
      {editing && (
        <EntryFormModal
          entry={editing}
          onClose={() => {
            setEditing(null);
            void loadEntries();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={t('timer.deleteEntryTitle')}
          body={t('timer.deleteEntryBody')}
          confirmLabel={t('common.confirmDelete')}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
      {/* لینک ساده برای رفتن به پروژه‌ها وقتی همه بایگانی شدن */}
      {usable.length === 0 && (
        <p className="muted">
          <Link href="/projects/">{t('nav.projects')}</Link>
        </p>
      )}
    </>
  );
}
