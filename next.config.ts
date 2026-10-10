/*
 * تنظیمات Next.js
 * ----------------
 * اینجا Next رو به‌صورت «خروجی استاتیک» می‌سازیم، چون داخل Electron سرور Node نداریم.
 * خروجی تو پوشه‌ی out میره و پروتکل app://timeflow/ اونو سرو می‌کنه.
 * ممنوع‌ها: API route، middleware، Server Action، SSR، next/font/google.
 */
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  // نکست ۱۶ به‌صورت خودکار AGENTS.md می‌سازه؛ تو این ریپو لازمش نداریم
  agentRules: false,
};

export default config;
