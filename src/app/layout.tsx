/*
 * Layout ریشه
 * ------------
 * فونت‌ها از npm میان (آفلاین): Inter برای لاتین و Vazirmatn برای فارسی.
 * lang و dir رو Providers از سمت کلاینت ست می‌کنه، برای همین suppressHydrationWarning لازمه.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/vazirmatn';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'TimeFlow',
  description: 'Offline time tracker for freelancers',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-theme="system" suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
