'use client';
/*
 * صفحه‌ی پروژه‌ها
 * ----------------
 * کارت هر پروژه: رنگ، مشتری، نرخ، زمان و درآمد «این ماه» و کل زمان.
 * بایگانی/بازگردانی، ویرایش، حذف (با تأیید) و شروع سریع تایمر.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectWithStats } from '@shared/types';
import { ConfirmDialog } from '@/components/Modal';
import { ProjectFormModal } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { formatDuration, formatMoney } from '@/lib/intl';
import { useApp } from '@/stores/app';

export default function ProjectsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const lang = useApp((s) => s.lang);
  const currency = useApp((s) => s.settings.currency);
  const projects = useApp((s) => s.projects);
  const run = useApp((s) => s.run);
  const refresh = useApp((s) => s.refreshProjects);
  const activeProjectId = useApp((s) => s.timer.active?.projectId);

  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ProjectWithStats | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ProjectWithStats | null>(null);

  const visible = projects.filter((p) => showArchived || !p.archivedAt);
  const hasArchived = projects.some((p) => p.archivedAt);

  const track = async (p: ProjectWithStats) => {
    if (!window.api) return;
    const res = await run(window.api.timer.start({ projectId: p.id, description: '' }));
    if (res) router.push('/');
  };
  const setArchived = async (p: ProjectWithStats, archived: boolean) => {
    if (!window.api) return;
    await run(window.api.projects.setArchived(p.id, archived));
    await refresh();
  };
  const remove = async () => {
    if (!deleting || !window.api) return;
    await run(window.api.projects.remove(deleting.id));
    setDeleting(null);
    await refresh();
  };

  return (
    <>
      <PageHeader title={t('projects.title')} subtitle={t('projects.subtitle')}>
        {hasArchived && (
          <label className="check">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            <span>{t('projects.showArchived')}</span>
          </label>
        )}
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <Icon name="plus" /> {t('projects.new')}
        </button>
      </PageHeader>

      {visible.length === 0 ? (
        <div className="empty card">
          <Icon name="folder" size={36} />
          <h2>{t('projects.emptyTitle')}</h2>
          <p className="muted">{t('projects.emptyBody')}</p>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="plus" /> {t('projects.new')}
          </button>
        </div>
      ) : (
        <div className="grid">
          {visible.map((p) => (
            <article key={p.id} className={`card project-card${p.archivedAt ? ' is-archived' : ''}`}>
              <span className="project-bar" style={{ background: p.color }} />
              <div className="project-head">
                <div>
                  <h3>{p.name}</h3>
                  <p className="muted">{p.client || '—'}</p>
                </div>
                {p.archivedAt ? (
                  <span className="badge">{t('projects.archivedBadge')}</span>
                ) : activeProjectId === p.id ? (
                  <span className="badge badge-live">{t('timer.runningNow')}</span>
                ) : null}
              </div>

              <dl className="stats">
                <div>
                  <dt>{t('projects.thisMonth')}</dt>
                  <dd dir="ltr">{formatDuration(p.monthSeconds, lang)}</dd>
                </div>
                <div>
                  <dt>{t('projects.total')}</dt>
                  <dd dir="ltr">{formatDuration(p.totalSeconds, lang)}</dd>
                </div>
                <div>
                  <dt>{t('projects.earned')}</dt>
                  <dd>
                    {p.hourlyRateCents === null ? '—' : formatMoney(p.monthEarningsCents, currency, lang)}
                  </dd>
                </div>
                <div>
                  <dt>{t('projects.hourlyRate')}</dt>
                  <dd>
                    {p.hourlyRateCents === null
                      ? t('common.noRate')
                      : `${formatMoney(p.hourlyRateCents, currency, lang)} ${t('common.perHour')}`}
                  </dd>
                </div>
              </dl>

              <div className="card-actions">
                {!p.archivedAt && (
                  <button className="btn btn-sm btn-primary" onClick={() => void track(p)}>
                    <Icon name="play" size={14} /> {t('projects.track')}
                  </button>
                )}
                <button className="icon-btn" aria-label={t('common.edit')} onClick={() => setEditing(p)}>
                  <Icon name="edit" />
                </button>
                <button
                  className="icon-btn"
                  aria-label={p.archivedAt ? t('projects.unarchive') : t('projects.archive')}
                  title={p.archivedAt ? t('projects.unarchive') : t('projects.archive')}
                  onClick={() => void setArchived(p, !p.archivedAt)}
                >
                  <Icon name={p.archivedAt ? 'restore' : 'archive'} />
                </button>
                <button className="icon-btn" aria-label={t('common.delete')} onClick={() => setDeleting(p)}>
                  <Icon name="trash" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <ProjectFormModal project={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <ConfirmDialog
          title={t('projects.deleteTitle')}
          body={t('projects.deleteBody')}
          confirmLabel={t('common.confirmDelete')}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}
