/*
 * ساخت نمونه‌ی i18next (مشترک بین Main و Renderer)
 * --------------------------------------------------
 * هر دو طرف با createInstance یک نمونه‌ی مستقل می‌سازن، ولی منبع ترجمه یکیه.
 * کلید ترجمه‌ی خطاها: errors.<code>
 */
import i18next, { type i18n } from 'i18next';
import { en } from './en';
import { fa } from './fa';
import type { ErrorCode, Language } from '../types';

export const resources = {
  en: { translation: en },
  fa: { translation: fa },
} as const;

/** نمونه‌ی تازه‌ی i18next با زبان داده‌شده (همگام، بدون initAsync) */
export function createI18n(lng: Language): i18n {
  const instance = i18next.createInstance();
  void instance.init({
    lng,
    fallbackLng: 'en',
    resources,
    interpolation: { escapeValue: false },
    initAsync: false,
    returnNull: false,
  });
  return instance;
}

/** کلید ترجمه‌ی یک کد خطا */
export const errorKey = (code: ErrorCode | string): string => `errors.${code}`;

export const isRtl = (lang: Language): boolean => lang === 'fa';
