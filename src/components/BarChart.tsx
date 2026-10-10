'use client';
/*
 * نمودار میله‌ای ساعت‌های روزانه (بدون کتابخانه)
 * -----------------------------------------------
 * برای بازه‌های بلند (بیشتر از ۶۲ روز) میله‌ها هفتگی جمع می‌شن تا شلوغ نشه.
 * جهت بر اساس direction صفحه خودکار درسته (در RTL اولین روز سمت راسته).
 */
import { useMemo } from 'react';
import type { Language, ReportDay } from '@shared/types';
import { formatDayLabel, formatHours, formatWeekday } from '@/lib/intl';

interface Bar {
  label: string;
  title: string;
  seconds: number;
}

export function BarChart({ days, lang }: { days: ReportDay[]; lang: Language }) {
  const bars: Bar[] = useMemo(() => {
    if (days.length <= 62) {
      const showWeekday = days.length <= 8;
      return days.map((d) => ({
        label: showWeekday ? formatWeekday(d.date, lang) : formatDayLabel(d.date, lang),
        title: `${formatDayLabel(d.date, lang, 'long')} — ${formatHours(d.seconds, lang)}`,
        seconds: d.seconds,
      }));
    }
    const out: Bar[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      const first = chunk[0] as ReportDay;
      const last = chunk[chunk.length - 1] as ReportDay;
      out.push({
        label: formatDayLabel(first.date, lang),
        title: `${formatDayLabel(first.date, lang)} – ${formatDayLabel(last.date, lang)} — ${formatHours(
          chunk.reduce((s, d) => s + d.seconds, 0),
          lang,
        )}`,
        seconds: chunk.reduce((s, d) => s + d.seconds, 0),
      });
    }
    return out;
  }, [days, lang]);

  const max = Math.max(1, ...bars.map((b) => b.seconds));
  // برچسب‌ها اگه زیاد بودن هر چند تا یکی نشون داده می‌شه
  const labelEvery = bars.length > 14 ? Math.ceil(bars.length / 10) : 1;

  return (
    <div className="chart" role="img" aria-label={bars.map((b) => b.title).join('; ')}>
      <div className="chart-bars">
        {bars.map((b, i) => (
          <div key={i} className="chart-col" title={b.title}>
            <span className="chart-value" dir="ltr">
              {b.seconds > 0 ? formatHours(b.seconds, lang) : ''}
            </span>
            <span className="chart-bar-track">
              <span
                className="chart-bar"
                style={{ blockSize: `${Math.max(b.seconds > 0 ? 4 : 0, (b.seconds / max) * 100)}%` }}
              />
            </span>
            <span className="chart-label">{i % labelEvery === 0 ? b.label : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
