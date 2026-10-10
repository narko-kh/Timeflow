/*
 * تست بخش‌های امنیتی خالص: path traversal، CSP و فرستنده‌ی مطمئن IPC
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCsp, isTrustedSender } from '../electron/main/platform/security';
import { findSegmentFile, resolveRequestPath } from '../electron/main/platform/static-paths';

const root = path.resolve('/srv/out');

describe('resolveRequestPath', () => {
  it('مسیرهای عادی داخل ریشه می‌مونن', () => {
    expect(resolveRequestPath(root, '/')).toBe(path.join(root, 'index.html'));
    expect(resolveRequestPath(root, '/_next/static/a.js')).toBe(path.join(root, '_next', 'static', 'a.js'));
  });

  it('path traversal رد می‌شه (null → 403)', () => {
    for (const bad of ['/../secret', '/..%2f..%2fetc/passwd', '/a/../../b', '/%2e%2e/%2e%2e/x', '/x%00.html']) {
      expect(resolveRequestPath(root, bad)).toBeNull();
    }
  });

  it('درصد‌کدگذاری خراب رد می‌شه', () => {
    expect(resolveRequestPath(root, '/%E0%A4%A')).toBeNull();
  });
});

describe('findSegmentFile', () => {
  const files = new Set([path.join(root, 'projects', '__next.projects', '__PAGE__.txt')]);
  const exists = (p: string) => files.has(p);

  it('اسم نقطه‌دار نکست به مسیر پوشه‌ای روی دیسک تبدیل می‌شه', () => {
    const asked = path.join(root, 'projects', '__next.projects.__PAGE__.txt');
    expect(findSegmentFile(asked, exists)).toBe(path.join(root, 'projects', '__next.projects', '__PAGE__.txt'));
  });

  it('فایل واقعاً نبود = null', () => {
    expect(findSegmentFile(path.join(root, 'nope.txt'), exists)).toBeNull();
    expect(findSegmentFile(path.join(root, 'x', '__next.a.b.txt'), exists)).toBeNull();
  });
});

describe('CSP', () => {
  it('production: فقط self، بدون eval، با هش اسکریپت‌ها', () => {
    const csp = buildCsp({ dev: false, scriptHashes: ['abc123='] });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'sha256-abc123='");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("connect-src 'self'");
  });

  it('بدون هش: برای script-src به unsafe-inline برمی‌گرده (فقط script-src)', () => {
    const csp = buildCsp({ dev: false, scriptHashes: [] });
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });

  it('dev آزادتره', () => {
    expect(buildCsp({ dev: true, scriptHashes: [] })).toContain('unsafe-eval');
  });
});

describe('isTrustedSender', () => {
  it('فقط app://timeflow و آدرس dev', () => {
    expect(isTrustedSender('app://timeflow/', undefined)).toBe(true);
    expect(isTrustedSender('app://timeflow/projects/', undefined)).toBe(true);
    expect(isTrustedSender('http://localhost:3000/projects', 'http://localhost:3000')).toBe(true);
  });
  it('بقیه رد می‌شن', () => {
    expect(isTrustedSender('https://evil.example/', undefined)).toBe(false);
    expect(isTrustedSender('app://timeflow.evil/', undefined)).toBe(false);
    expect(isTrustedSender('file:///etc/passwd', undefined)).toBe(false);
    expect(isTrustedSender('http://localhost:3000/', undefined)).toBe(false);
    expect(isTrustedSender(undefined, 'http://localhost:3000')).toBe(false);
  });
});
