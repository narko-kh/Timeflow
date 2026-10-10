/*
 * منطق خالص مسیرها برای پروتکل app://
 * ------------------------------------
 * بدون وابستگی به Electron تا تو تست‌های Vitest مستقیم بررسی بشه
 * (جلوگیری از path traversal و تطبیق اسم فایل‌های RSC نکست).
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * حل کردن مسیر درخواست به یک فایل داخل root.
 * null یعنی خارج از root (حمله‌ی path traversal).
 */
export function resolveRequestPath(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  let rel = decoded.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  const target = path.resolve(root, rel);
  const rootResolved = path.resolve(root);
  if (target !== rootResolved && !target.startsWith(rootResolved + path.sep)) return null;
  return target;
}

/**
 * Next 16 فایل‌های RSC رو با اسم `__next.projects.__PAGE__.txt` درخواست می‌کنه،
 * ولی تو خروجی استاتیک به شکل `__next.projects/__PAGE__.txt` روی دیسک هستن.
 * اگه فایل درخواستی نبود، نقطه‌های وسط اسم رو (از راست) به / تبدیل می‌کنیم و دوباره می‌گردیم.
 */
export function findSegmentFile(file: string, exists: (p: string) => boolean = fs.existsSync): string | null {
  if (exists(file)) return file;
  const dir = path.dirname(file);
  const base = path.basename(file);
  if (!base.startsWith('__next.') || !base.endsWith('.txt')) return null;
  const inner = base.slice('__next.'.length, -'.txt'.length);
  const parts = inner.split('.');
  // آخرین بخش اسم فایله و بقیه پوشه؛ از طولانی‌ترین مسیر به کوتاه‌ترین امتحان می‌کنیم
  for (let cut = parts.length - 1; cut >= 1; cut--) {
    const folder = '__next.' + parts.slice(0, cut).join('.');
    const rest = parts.slice(cut).join('.') + '.txt';
    const candidate = path.join(dir, folder, rest);
    if (exists(candidate)) return candidate;
  }
  return null;
}
