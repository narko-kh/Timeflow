/*
 * خطای برنامه
 * ------------
 * سرویس‌ها فقط AppError پرت می‌کنن و code یکی از ERROR_CODES هست.
 * لایه‌ی IPC اینو به { ok:false, code } تبدیل می‌کنه و جزئیات داخلی هیچ‌وقت به صفحه نمی‌رسه.
 */
import type { ErrorCode } from '@shared/types';

export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(code);
    this.name = 'AppError';
    this.code = code;
  }
}
