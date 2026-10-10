/*
 * سربرگ مشترک صفحه‌ها (عنوان + توضیح + دکمه‌های سمت انتها)
 */
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-header-end">{children}</div>}
    </header>
  );
}
