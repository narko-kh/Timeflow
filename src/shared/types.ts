/*
 * تایپ‌های مشترک بین Main و Renderer
 * -----------------------------------
 * همه‌ی شکل داده‌هایی که از IPC رد می‌شن اینجا تعریف شدن.
 * این فایل هیچ وابستگی به Electron یا دیتابیس نداره.
 * تاریخ‌ها همیشه ISO-8601 (رشته) هستن و پول به «سنت» (عدد صحیح).
 */

/** کدهای خطا — هر کدوم یک کلید ترجمه تو errors.<code> هستن */
export const ERROR_CODES = [
  'name_required',
  'name_too_long',
  'client_too_long',
  'description_too_long',
  'color_invalid',
  'rate_invalid',
  'id_invalid',
  'date_invalid',
  'end_before_start',
  'end_in_future',
  'range_invalid',
  'range_too_large',
  'project_archived',
  'project_invalid',
  'project_not_found',
  'entry_not_found',
  'entry_active',
  'no_project',
  'settings_invalid',
  'unknown_setting',
  'forbidden',
  'internal',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** خروجی استاندارد همه‌ی هندلرهای IPC */
export type Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode };

export type EntrySource = 'timer' | 'manual' | 'pomodoro';

export interface Project {
  id: string;
  name: string;
  client: string;
  color: string;
  /** نرخ ساعتی به سنت؛ null یعنی بدون نرخ */
  hourlyRateCents: number | null;
  archivedAt: string | null;
  createdAt: string;
}

/** پروژه همراه آمار (برای کارت‌های صفحه‌ی پروژه‌ها) */
export interface ProjectWithStats extends Project {
  totalSeconds: number;
  monthSeconds: number;
  monthEarningsCents: number;
}

export interface ProjectInput {
  name: string;
  client: string;
  color: string;
  hourlyRateCents: number | null;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  description: string;
  startedAt: string;
  /** null یعنی هنوز در حال اجراست */
  endedAt: string | null;
  source: EntrySource;
}

export interface ManualEntryInput {
  projectId: string;
  description: string;
  startedAt: string;
  endedAt: string;
}

export interface EntryUpdateInput {
  id: string;
  projectId?: string;
  description?: string;
  startedAt?: string;
  endedAt?: string;
}

/** بازه‌ی روزهای «محلی» — هر دو سر شامل (YYYY-MM-DD) */
export interface DateRange {
  from: string;
  to: string;
}

export interface EntryQuery extends DateRange {
  projectId?: string;
}

// ---------- Pomodoro ----------
export type PomodoroPhase = 'idle' | 'work' | 'shortBreak' | 'longBreak';

export interface PomodoroState {
  phase: PomodoroPhase;
  /** لحظه‌ی شروع مرحله (ms) */
  startedAt: number | null;
  /** لحظه‌ی پایان مرحله (ms) */
  endsAt: number | null;
  /** تعداد دوره‌های تمرکز کامل‌شده در این سری */
  completedWork: number;
}

export interface PomodoroConfig {
  workMs: number;
  shortBreakMs: number;
  longBreakMs: number;
  /** بعد از هر چند دوره تمرکز، استراحت بلند بیاد */
  longEvery: number;
}

// ---------- Timer ----------
export interface ActiveTimer {
  entryId: string;
  projectId: string;
  description: string;
  startedAt: string;
  source: EntrySource;
}

export interface TimerState {
  active: ActiveTimer | null;
  pomodoro: PomodoroState;
}

export interface StartTimerInput {
  projectId: string;
  description: string;
}

// ---------- Settings ----------
export type LanguageSetting = 'system' | 'en' | 'fa';
export type ThemeSetting = 'system' | 'light' | 'dark';
export type Language = 'en' | 'fa';

export interface Settings {
  language: LanguageSetting;
  theme: ThemeSetting;
  currency: string;
  idleDetection: boolean;
  idleMinutes: number;
  pomodoroEnabled: boolean;
  pomodoroWorkMinutes: number;
  pomodoroShortBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodoroLongEvery: number;
  closeToTray: boolean;
  shortcutEnabled: boolean;
}

export type SettingsPatch = Partial<Settings>;

// ---------- Reports ----------
export interface ReportDay {
  /** YYYY-MM-DD محلی */
  date: string;
  seconds: number;
  earningsCents: number;
}

export interface ReportProjectRow {
  projectId: string;
  name: string;
  client: string;
  color: string;
  hourlyRateCents: number | null;
  seconds: number;
  earningsCents: number;
  entryCount: number;
}

export interface Report {
  range: DateRange;
  totalSeconds: number;
  totalEarningsCents: number;
  entryCount: number;
  days: ReportDay[];
  projects: ReportProjectRow[];
}

// ---------- System ----------
export interface SystemInfo {
  appVersion: string;
  platform: 'win32' | 'darwin' | 'linux';
  locale: string;
  dataPath: string;
  shortcut: { accelerator: string; registered: boolean };
  trayAvailable: boolean;
}

export interface ExportCsvResult {
  saved: boolean;
  path?: string;
}
