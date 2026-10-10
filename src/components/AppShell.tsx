'use client';
/*
 * قاب اصلی برنامه: نوار کناری + محتوا
 * -------------------------------------
 * نوار کناری یک pill زنده‌ی تایمر در حال اجرا داره که از همه‌ی صفحه‌ها دیده می‌شه.
 * چیدمان با ویژگی‌های logical نوشته شده تا RTL خودکار درست بشه.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { formatClock } from '@shared/format';
import { useNow } from '@/lib/hooks';
import { useApp } from '@/stores/app';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';
import { Toasts } from './Toasts';

const NAV: Array<{ href: string; key: string; icon: IconName }> = [
  { href: '/', key: 'nav.timer', icon: 'timer' },
  { href: '/projects/', key: 'nav.projects', icon: 'folder' },
  { href: '/reports/', key: 'nav.reports', icon: 'chart' },
  { href: '/settings/', key: 'nav.settings', icon: 'settings' },
];

function RunningPill() {
  const { t } = useTranslation();
  const active = useApp((s) => s.timer.active);
  const projects = useApp((s) => s.projects);
  const now = useNow();
  if (!active) return null;
  const project = projects.find((p) => p.id === active.projectId);
  const seconds = (now - Date.parse(active.startedAt)) / 1000;
  return (
    <Link href="/" className="pill" aria-label={t('nav.running')}>
      <span className="pill-dot" style={{ background: project?.color ?? 'var(--primary)' }} />
      <span className="pill-body">
        <span className="pill-name">{project?.name ?? '…'}</span>
        <span className="pill-time" dir="ltr">
          {formatClock(seconds)}
        </span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname() ?? '/';
  const norm = (p: string) => (p.endsWith('/') ? p : `${p}/`);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo size={34} />
          <span className="brand-name">{t('app.name')}</span>
        </div>
        <nav aria-label="Main">
          {NAV.map((item) => {
            const active = norm(pathname) === norm(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={item.icon} />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <RunningPill />
      </aside>
      <main className="content" id="main">
        {children}
      </main>
      <Toasts />
    </div>
  );
}
