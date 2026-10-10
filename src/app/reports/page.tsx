'use client';
/*
 * صفحه‌ی گزارش‌ها
 * ----------------
 * تب بازه (امروز / این هفته / این ماه / دلخواه)، فیلتر پروژه، سه کارت خلاصه،
 * نمودار میله‌ای روزانه، جدول هر پروژه و خروجی CSV.
 * هفته‌ی فارسی از شنبه شروع می‌شه و انگلیسی از دوشنبه.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, presetRange, toDayString, type RangePreset } from '@shared/time';
import type { DateRange, Report } from '@shared/types';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { BarChart } from '@/components/BarChart';
import { formatDayLabel, formatDuration, formatMoney, formatNumber } from '@/lib/intl';
import { useApp } from '@/stores/app';

type Tab = RangePreset | 'custom';

export default function ReportsPage() {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const currency = useApp((s) => s.settings.currency);
  const projects = useApp((s) => s.projects);
  const run = useApp((s) => s.run);
  const toastSuccess = useApp((s) => s.toastSuccess);
  const activeEntryId = useApp((s) => s.timer.active?.entryId);

  const [tab, setTab] = useState<Tab>('week');
  const today = toDayString(new Date());
  const [custom, setCustom] = useState<DateRange>({ from: addDays(today, -6), to: today });
  const [projectId, setProjectId] = useState('');
  const [report, setReport] = useState<Report | null>(null);

  const range: DateRange = useMemo(
    () => (tab === 'custom' ? custom : presetRange(tab, new Date(), lang)),
    [tab, custom, lang],
  );

  const load = useCallback(async () => {
    if (!window.api) return;
    if (range.from > range.to) return;
    const res = await window.api.reports.get({ ...range, ...(projectId ? { projectId } : {}) });
    if (res.ok) setReport(res.data);
    else useApp.getState().toastError(res.code);
  }, [range, projectId]);

  // با تغییر بازه/فیلتر یا شروع/توقف تایمر گزارش دوباره ساخته می‌شه
  useEffect(() => {
    void load();
  }, [load, activeEntryId]);

  const exportCsv = async () => {
    if (!window.api) return;
    const res = await run(window.api.reports.exportCsv({ ...range, ...(projectId ? { projectId } : {}) }));
    if (res?.saved) toastSuccess('reports.exported');
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'today', label: t('reports.today') },
    { id: 'week', label: t('reports.week') },
    { id: 'month', label: t('reports.month') },
    { id: 'custom', label: t('reports.custom') },
  ];

  const total = report?.totalSeconds ?? 0;
  const hasRates = report?.projects.some((p) => p.hourlyRateCents !== null) ?? false;

  return (
    <>
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')}>
        <button className="btn" onClick={() => void exportCsv()} disabled={!report || report.entryCount === 0}>
          <Icon name="download" /> {t('reports.exportCsv')}
        </button>
      </PageHeader>

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label={t('reports.title')}>
          {tabs.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              className={tab === x.id ? 'is-active' : ''}
              onClick={() => setTab(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>
        {tab === 'custom' && (
          <div className="range-inputs">
            <label>
              <span className="sr-only">{t('reports.from')}</span>
              <input
                className="input"
                type="date"
                value={custom.from}
                max={custom.to}
                onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })}
              />
            </label>
            <span className="muted">→</span>
            <label>
              <span className="sr-only">{t('reports.to')}</span>
              <input
                className="input"
                type="date"
                value={custom.to}
                min={custom.from}
                onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })}
              />
            </label>
          </div>
        )}
        <select
          className="input toolbar-end"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label={t('timer.project')}
        >
          <option value="">{t('reports.allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <p className="muted range-label">
        {formatDayLabel(range.from, lang, 'long')}
        {range.from !== range.to && ` — ${formatDayLabel(range.to, lang, 'long')}`}
      </p>

      <div className="summary">
        <div className="card stat-card">
          <span className="muted">{t('reports.totalTime')}</span>
          <strong className="stat-value" dir="ltr">
            {formatDuration(total, lang)}
          </strong>
        </div>
        <div className="card stat-card">
          <span className="muted">{t('reports.earnings')}</span>
          <strong className="stat-value">
            {hasRates ? formatMoney(report?.totalEarningsCents ?? 0, currency, lang) : '—'}
          </strong>
        </div>
        <div className="card stat-card">
          <span className="muted">{t('reports.entries')}</span>
          <strong className="stat-value">{formatNumber(report?.entryCount ?? 0, lang)}</strong>
        </div>
      </div>

      {report && report.entryCount === 0 ? (
        <div className="empty card">
          <Icon name="chart" size={36} />
          <p>{t('reports.noData')}</p>
          <p className="muted">{t('reports.noDataHint')}</p>
        </div>
      ) : (
        report && (
          <>
            <section className="card">
              <h2>{t('reports.daily')}</h2>
              <BarChart days={report.days} lang={lang} />
            </section>

            <section className="card">
              <h2>{t('reports.byProject')}</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('reports.project')}</th>
                      <th>{t('reports.time')}</th>
                      <th>{t('reports.amount')}</th>
                      <th>{t('reports.share')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.projects.map((p) => {
                      const share = total > 0 ? p.seconds / total : 0;
                      return (
                        <tr key={p.projectId}>
                          <td>
                            <span className="dot" style={{ background: p.color }} /> {p.name}
                            {p.client && <span className="muted"> · {p.client}</span>}
                          </td>
                          <td dir="ltr">{formatDuration(p.seconds, lang)}</td>
                          <td>
                            {p.hourlyRateCents === null ? '—' : formatMoney(p.earningsCents, currency, lang)}
                          </td>
                          <td>
                            <div className="share">
                              <span className="share-bar">
                                <span style={{ inlineSize: `${share * 100}%`, background: p.color }} />
                              </span>
                              <span className="muted">
                                {new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', {
                                  style: 'percent',
                                  maximumFractionDigits: 0,
                                }).format(share)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
