'use client';
/*
 * صفحه‌ی لودینگ / خطای راه‌اندازی
 * ---------------------------------
 * متن‌ها عمداً دوزبانه و ثابت هستن چون ممکنه هنوز تنظیمات زبان نرسیده باشه.
 */
import { Logo } from './Logo';

export function Splash({ state }: { state: 'loading' | 'failed' | 'nobridge' }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <Logo size={56} />
      {state === 'loading' && <div className="splash-spinner" aria-hidden="true" />}
      {state === 'failed' && (
        <p className="splash-text">
          Could not start the database. Please restart TimeFlow.
          <br />
          راه‌اندازی دیتابیس شکست خورد. برنامه رو دوباره باز کن.
        </p>
      )}
      {state === 'nobridge' && (
        <p className="splash-text">
          TimeFlow runs as a desktop app. Open it with <code>npm run dev</code> or the installer.
          <br />
          تایم‌فلو یک برنامه‌ی دسکتاپه و داخل مرورگر کار نمی‌کنه.
        </p>
      )}
    </div>
  );
}
