/*
 * i18next سمت Renderer
 * ---------------------
 * یک نمونه‌ی سراسری که منبع ترجمه‌اش همون src/shared/i18n هست.
 * تغییر زبان فوریه چون changeLanguage همگامه و کامپوننت‌ها با هوک دوباره رندر می‌شن.
 */
import { createI18n } from '@shared/i18n';

export const i18n = createI18n('en');
