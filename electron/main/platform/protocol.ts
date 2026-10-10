/*
 * پروتکل سفارشی app://timeflow/
 * ------------------------------
 * خروجی استاتیک Next با file:// خراب می‌شه (مسیرهای /_next/...)، پس خودمون سرو می‌کنیم.
 *  - ریشه‌ی / → index.html
 *  - مسیر بدون پسوند → <path>/index.html
 *  - مسیر نهایی حتماً باید داخل پوشه‌ی out باشه، وگرنه 403 (path traversal)
 *  - روی هر پاسخ هدرهای امنیتی (CSP و ...) گذاشته می‌شه
 */
import { net, protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCsp } from './security';
import { findSegmentFile, resolveRequestPath } from './static-paths';

/** باید قبل از app.whenReady() صدا زده بشه */
export function registerSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

/** خوندن هش‌های CSP که بعد از build ساخته شده؛ نبود فایل = لیست خالی */
function loadScriptHashes(root: string): string[] {
  try {
    const raw = fs.readFileSync(path.join(root, '_csp-hashes.json'), 'utf8');
    const data = JSON.parse(raw) as { scriptHashes?: unknown };
    return Array.isArray(data.scriptHashes)
      ? data.scriptHashes.filter((h): h is string => typeof h === 'string')
      : [];
  } catch {
    return [];
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

export function registerAppProtocol(rootDir: string): void {
  const root = path.resolve(rootDir);
  const csp = buildCsp({ dev: false, scriptHashes: loadScriptHashes(root) });

  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    const headers = { ...SECURITY_HEADERS, 'Content-Security-Policy': csp };

    const target = resolveRequestPath(root, url.pathname);
    if (!target) return new Response('Forbidden', { status: 403, headers });
    // فایل داخلی هش‌ها نباید سرو بشه
    if (path.basename(target).startsWith('_csp-')) {
      return new Response('Not found', { status: 404, headers });
    }

    let file = target;
    try {
      const stat = fs.statSync(file);
      if (stat.isDirectory()) file = path.join(file, 'index.html');
    } catch {
      // بدون پسوند: /projects → /projects/index.html
      if (path.extname(file) === '') file = path.join(file, 'index.html');
    }

    const found = findSegmentFile(file);
    if (!found) return new Response('Not found', { status: 404, headers });
    file = found;

    const res = await net.fetch(pathToFileURL(file).toString());
    const out = new Headers(res.headers);
    for (const [k, v] of Object.entries(headers)) out.set(k, v);
    return new Response(res.body, { status: res.status, headers: out });
  });
}
