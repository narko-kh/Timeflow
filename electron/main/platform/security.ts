/*
 * سیاست امنیتی (CSP و تشخیص فرستنده‌ی مطمئن)
 * --------------------------------------------
 * CSP سخت برای حالت production: فقط منابع خود برنامه.
 * اسکریپت‌های inline خروجی استاتیک Next با هش sha256 مجاز می‌شن (scripts/csp-hashes.mjs
 * بعد از build هش‌ها رو تو out/_csp-hashes.json می‌نویسه). اگه فایل نبود،
 * برای script-src به 'unsafe-inline' برمی‌گردیم تا برنامه از کار نیفته.
 */

export const APP_ORIGIN = 'app://timeflow';
export const APP_URL = `${APP_ORIGIN}/`;

export interface CspOptions {
  dev: boolean;
  /** هش‌های sha256 (به شکل base64) اسکریپت‌های inline */
  scriptHashes: string[];
}

export function buildCsp({ dev, scriptHashes }: CspOptions): string {
  if (dev) {
    // حالت توسعه: HMR و eval لازمه
    return [
      "default-src 'self' http://localhost:* ws://localhost:*",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*",
      "style-src 'self' 'unsafe-inline' http://localhost:*",
      "img-src 'self' data: http://localhost:*",
      "font-src 'self' data: http://localhost:*",
      "connect-src 'self' http://localhost:* ws://localhost:*",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ');
  }
  const scriptSrc =
    scriptHashes.length > 0
      ? `script-src 'self' ${scriptHashes.map((h) => `'sha256-${h}'`).join(' ')}`
      : "script-src 'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    scriptSrc,
    // style-src: Next/React به attribute style و تگ style نیاز دارن (فقط استایل، نه اسکریپت)
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * آیا فرستنده‌ی IPC قابل اعتماده؟
 * فقط صفحه‌ی خود برنامه (app://timeflow/...) یا آدرس dev که از env میاد.
 */
export function isTrustedSender(url: string | undefined, devUrl: string | undefined): boolean {
  if (!url) return false;
  if (url === APP_ORIGIN || url.startsWith(`${APP_ORIGIN}/`)) return true;
  if (devUrl) {
    try {
      const allowed = new URL(devUrl).origin;
      if (new URL(url).origin === allowed) return true;
    } catch {
      return false;
    }
  }
  return false;
}
