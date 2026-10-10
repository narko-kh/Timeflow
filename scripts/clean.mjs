/*
 * پاک کردن خروجی بیلد Electron قبل از tsup
 * (دو ورودی tsup هم‌زمان اجرا می‌شن، پس پاک‌سازی رو جدا و قبل از اون انجام می‌دیم)
 */
import { rmSync } from 'node:fs';

rmSync('dist-electron', { recursive: true, force: true });
