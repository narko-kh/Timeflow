/*
 * تایپ سراسری window.api که preload می‌سازه.
 * ممکنه undefined باشه (موقع prerender یا اگه صفحه بیرون از Electron باز بشه).
 */
import type { TimeFlowApi } from '@shared/api';

declare global {
  interface Window {
    api?: TimeFlowApi;
  }
}

export {};
