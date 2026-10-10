/*
 * اعتبارسنجی ورودی‌ها
 * --------------------
 * هر چیزی که از Renderer میاد (حتی اگه فکر کنیم قابل اعتماده) از این توابع رد می‌شه.
 * توابع خالص هستن؛ یا مقدار تمیزشده برمی‌گردونن یا یک کد خطا.
 * هیچ‌وقت exception پرت نمی‌کنن تا هندلر IPC ساده بمونه.
 */
import type {
  DateRange,
  EntryQuery,
  EntryUpdateInput,
  ErrorCode,
  ManualEntryInput,
  ProjectInput,
  SettingsPatch,
  StartTimerInput,
} from './types';

export type Parsed<T> = { ok: true; value: T } | { ok: false; code: ErrorCode };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (code: ErrorCode): Parsed<never> => ({ ok: false, code });

export const LIMITS = {
  nameMax: 80,
  clientMax: 80,
  descriptionMax: 280,
  rangeMaxDays: 400,
  rateMaxCents: 100_000_000,
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseId(v: unknown): Parsed<string> {
  return typeof v === 'string' && UUID_RE.test(v) ? ok(v.toLowerCase()) : fail('id_invalid');
}

export function parseColor(v: unknown): Parsed<string> {
  return typeof v === 'string' && COLOR_RE.test(v) ? ok(v.toLowerCase()) : fail('color_invalid');
}

/** نرخ: عدد صحیح ≥ ۰ یا null */
export function parseRate(v: unknown): Parsed<number | null> {
  if (v === null || v === undefined) return ok(null);
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > LIMITS.rateMaxCents) {
    return fail('rate_invalid');
  }
  return ok(v);
}

/** تاریخ ISO کامل (با timezone) که واقعاً تاریخ معتبره */
export function parseIso(v: unknown): Parsed<string> {
  if (typeof v !== 'string' || !ISO_RE.test(v)) return fail('date_invalid');
  const t = Date.parse(v);
  if (Number.isNaN(t)) return fail('date_invalid');
  return ok(new Date(t).toISOString());
}

/** روز محلی به شکل YYYY-MM-DD؛ مثلاً 2025-02-30 رد می‌شه */
export function parseDay(v: unknown): Parsed<string> {
  if (typeof v !== 'string') return fail('range_invalid');
  const m = DAY_RE.exec(v);
  if (!m) return fail('range_invalid');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return fail('range_invalid');
  }
  return ok(v);
}

/** تعداد روزهای (شامل) بین دو YYYY-MM-DD */
export function daysBetweenInclusive(from: string, to: string): number {
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  return Math.round((b - a) / 86_400_000) + 1;
}

export function parseRange(v: unknown): Parsed<DateRange> {
  if (!isObject(v)) return fail('range_invalid');
  const from = parseDay(v.from);
  if (!from.ok) return from;
  const to = parseDay(v.to);
  if (!to.ok) return to;
  const n = daysBetweenInclusive(from.value, to.value);
  if (n < 1) return fail('range_invalid');
  if (n > LIMITS.rangeMaxDays) return fail('range_too_large');
  return ok({ from: from.value, to: to.value });
}

export function parseEntryQuery(v: unknown): Parsed<EntryQuery> {
  const range = parseRange(v);
  if (!range.ok) return range;
  const raw = v as Record<string, unknown>;
  if (raw.projectId === undefined || raw.projectId === null) return ok({ ...range.value });
  const id = parseId(raw.projectId);
  if (!id.ok) return id;
  return ok({ ...range.value, projectId: id.value });
}

function parseName(v: unknown): Parsed<string> {
  if (typeof v !== 'string') return fail('name_required');
  const s = v.trim();
  if (s.length === 0) return fail('name_required');
  if (s.length > LIMITS.nameMax) return fail('name_too_long');
  return ok(s);
}

function parseClient(v: unknown): Parsed<string> {
  if (v === undefined || v === null) return ok('');
  if (typeof v !== 'string') return fail('client_too_long');
  const s = v.trim();
  return s.length > LIMITS.clientMax ? fail('client_too_long') : ok(s);
}

export function parseDescription(v: unknown): Parsed<string> {
  if (v === undefined || v === null) return ok('');
  if (typeof v !== 'string') return fail('description_too_long');
  const s = v.trim();
  return s.length > LIMITS.descriptionMax ? fail('description_too_long') : ok(s);
}

export function parseProjectInput(v: unknown): Parsed<ProjectInput> {
  if (!isObject(v)) return fail('name_required');
  const name = parseName(v.name);
  if (!name.ok) return name;
  const client = parseClient(v.client);
  if (!client.ok) return client;
  const color = parseColor(v.color);
  if (!color.ok) return color;
  const rate = parseRate(v.hourlyRateCents);
  if (!rate.ok) return rate;
  return ok({
    name: name.value,
    client: client.value,
    color: color.value,
    hourlyRateCents: rate.value,
  });
}

export function parseStartInput(v: unknown): Parsed<StartTimerInput> {
  if (!isObject(v)) return fail('project_invalid');
  const id = parseId(v.projectId);
  if (!id.ok) return fail('project_invalid');
  const desc = parseDescription(v.description);
  if (!desc.ok) return desc;
  return ok({ projectId: id.value, description: desc.value });
}

export function parseManualEntry(v: unknown): Parsed<ManualEntryInput> {
  if (!isObject(v)) return fail('date_invalid');
  const projectId = parseId(v.projectId);
  if (!projectId.ok) return fail('project_invalid');
  const description = parseDescription(v.description);
  if (!description.ok) return description;
  const startedAt = parseIso(v.startedAt);
  if (!startedAt.ok) return startedAt;
  const endedAt = parseIso(v.endedAt);
  if (!endedAt.ok) return endedAt;
  if (Date.parse(endedAt.value) < Date.parse(startedAt.value)) return fail('end_before_start');
  return ok({
    projectId: projectId.value,
    description: description.value,
    startedAt: startedAt.value,
    endedAt: endedAt.value,
  });
}

export function parseEntryUpdate(v: unknown): Parsed<EntryUpdateInput> {
  if (!isObject(v)) return fail('id_invalid');
  const id = parseId(v.id);
  if (!id.ok) return id;
  const out: EntryUpdateInput = { id: id.value };
  if (v.projectId !== undefined) {
    const p = parseId(v.projectId);
    if (!p.ok) return fail('project_invalid');
    out.projectId = p.value;
  }
  if (v.description !== undefined) {
    const d = parseDescription(v.description);
    if (!d.ok) return d;
    out.description = d.value;
  }
  if (v.startedAt !== undefined) {
    const s = parseIso(v.startedAt);
    if (!s.ok) return s;
    out.startedAt = s.value;
  }
  if (v.endedAt !== undefined) {
    const e = parseIso(v.endedAt);
    if (!e.ok) return e;
    out.endedAt = e.value;
  }
  if (out.startedAt && out.endedAt && Date.parse(out.endedAt) < Date.parse(out.startedAt)) {
    return fail('end_before_start');
  }
  return ok(out);
}

// ---------- تنظیمات ----------
export const SUPPORTED_CURRENCIES: readonly string[] = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'AED',
  'TRY',
  'IRR',
];

const intIn =
  (min: number, max: number) =>
  (v: unknown): boolean =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** هر کلید مجاز یک اعتبارسنج داره؛ کلیدی که اینجا نیست = ناشناخته = رد */
const SETTING_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  language: (v) => v === 'system' || v === 'en' || v === 'fa',
  theme: (v) => v === 'system' || v === 'light' || v === 'dark',
  currency: (v) => typeof v === 'string' && SUPPORTED_CURRENCIES.includes(v),
  idleDetection: (v) => typeof v === 'boolean',
  idleMinutes: intIn(1, 240),
  pomodoroEnabled: (v) => typeof v === 'boolean',
  pomodoroWorkMinutes: intIn(1, 180),
  pomodoroShortBreakMinutes: intIn(1, 60),
  pomodoroLongBreakMinutes: intIn(1, 120),
  pomodoroLongEvery: intIn(2, 12),
  closeToTray: (v) => typeof v === 'boolean',
  shortcutEnabled: (v) => typeof v === 'boolean',
};

export const SETTING_KEYS = Object.keys(SETTING_VALIDATORS);

export function parseSettingsPatch(v: unknown): Parsed<SettingsPatch> {
  if (!isObject(v)) return fail('settings_invalid');
  const keys = Object.keys(v);
  if (keys.length === 0) return fail('settings_invalid');
  for (const key of keys) {
    const validate = SETTING_VALIDATORS[key];
    if (!validate) return fail('unknown_setting');
    if (!validate(v[key])) return fail('settings_invalid');
  }
  return ok({ ...v } as SettingsPatch);
}
