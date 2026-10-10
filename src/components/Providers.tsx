'use client';
/*
 * Providers
 * ----------
 * تا وقتی تنظیمات و داده‌ها از Main نیومدن یک صفحه‌ی لودینگ نشون می‌ده،
 * بعد children رو رندر می‌کنه. زبان، جهت (RTL) و تم رو روی <html> ست می‌کنه.
 * window.api فقط داخل useEffect استفاده می‌شه چون موقع prerender وجود نداره.
 */
import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n/client';
import { useApp } from '@/stores/app';
import { isRtl } from '@shared/i18n';
import { Splash } from './Splash';

export function Providers({ children }: { children: ReactNode }) {
  const ready = useApp((s) => s.ready);
  const failed = useApp((s) => s.failed);
  const noBridge = useApp((s) => s.noBridge);
  const lang = useApp((s) => s.lang);
  const theme = useApp((s) => s.settings.theme);
  const init = useApp((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  // زبان + جهت: همگام و فوری (بدون ری‌استارت)؛ layout effect تا فریم اشتباه دیده نشه
  useLayoutEffect(() => {
    void i18n.changeLanguage(lang);
    const html = document.documentElement;
    html.lang = lang;
    html.dir = isRtl(lang) ? 'rtl' : 'ltr';
  }, [lang]);

  // تم صریح: system | light | dark
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <I18nextProvider i18n={i18n}>
      {!ready ? <Splash state="loading" /> : failed ? <Splash state="failed" /> : noBridge ? <Splash state="nobridge" /> : children}
    </I18nextProvider>
  );
}
