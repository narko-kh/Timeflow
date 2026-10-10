'use client';
/*
 * Toast برای خطا و موفقیت
 * پیام از کد ترجمه می‌شه (errors.<code>)؛ جزئیات داخلی هیچ‌وقت نشون داده نمی‌شه.
 */
import { useTranslation } from 'react-i18next';
import { useApp } from '@/stores/app';

export function Toasts() {
  const { t } = useTranslation();
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);

  return (
    <div className="toasts" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          onClick={() => dismiss(toast.id)}
        >
          {t(toast.key)}
        </div>
      ))}
    </div>
  );
}
