/*
 * بیلد Main و Preload با tsup (esbuild)
 * --------------------------------------
 * هر دو خروجی CJS هستن چون preload داخل sandbox فقط CJS می‌فهمه.
 * electron و pglite و i18next بیرون از باندل می‌مونن (از node_modules لود می‌شن).
 * preload کاملاً self-contained ساخته می‌شه (فقط require('electron') داره).
 */
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { main: 'electron/main/index.ts' },
    outDir: 'dist-electron',
    format: ['cjs'],
    outExtension: () => ({ js: '.cjs' }),
    platform: 'node',
    target: 'node22',
    external: ['electron', '@electric-sql/pglite', 'i18next'],
    clean: false,
    sourcemap: false,
    splitting: false,
  },
  {
    entry: { preload: 'electron/preload/index.ts' },
    outDir: 'dist-electron',
    format: ['cjs'],
    outExtension: () => ({ js: '.cjs' }),
    platform: 'node',
    target: 'node22',
    external: ['electron'],
    clean: false,
    sourcemap: false,
    splitting: false,
  },
]);
