/*
 * ساخت هش‌های CSP بعد از build
 * -----------------------------
 * خروجی استاتیک Next چند اسکریپت inline داره. اینجا از همه‌ی فایل‌های out/**\/*.html
 * هش sha256 هر اسکریپت inline رو درمیاریم و تو out/_csp-hashes.json می‌نویسیم.
 * پروتکل app:// موقع اجرا این فایل رو می‌خونه و تو هدر Content-Security-Policy می‌ذاره.
 * (خود این فایل به صفحه سرو نمی‌شه.)
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'out';

/** همه‌ی فایل‌های html زیر یک پوشه */
function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (name.endsWith('.html')) files.push(full);
  }
  return files;
}

const hashes = new Set();
// فقط اسکریپت‌های بدون src (inline)
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

for (const file of walk(OUT)) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(re)) {
    const body = m[1];
    if (!body || body.trim() === '') continue;
    hashes.add(createHash('sha256').update(body, 'utf8').digest('base64'));
  }
}

writeFileSync(
  join(OUT, '_csp-hashes.json'),
  JSON.stringify({ scriptHashes: [...hashes].sort() }, null, 2),
);
console.log(`[csp] ${hashes.size} inline script hash(es) written to ${OUT}/_csp-hashes.json`);
