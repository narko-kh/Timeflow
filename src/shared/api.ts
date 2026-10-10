/*
 * شکل API که preload به صفحه می‌ده (window.api)
 * ------------------------------------------------
 * فقط تابع‌های مشخص؛ هیچ‌وقت ipcRenderer خام تو دسترس صفحه نیست.
 * همه‌ی تابع‌ها Result برمی‌گردونن (ok/data یا ok:false/code).
 */
import type {
  EntryQuery,
  EntryUpdateInput,
  ExportCsvResult,
  ManualEntryInput,
  Project,
  ProjectInput,
  ProjectWithStats,
  Report,
  Result,
  Settings,
  SettingsPatch,
  StartTimerInput,
  SystemInfo,
  TimeEntry,
  TimerState,
} from './types';

export type Unsubscribe = () => void;

export interface TimeFlowApi {
  projects: {
    list(): Promise<Result<ProjectWithStats[]>>;
    create(input: ProjectInput): Promise<Result<Project>>;
    update(id: string, input: ProjectInput): Promise<Result<Project>>;
    setArchived(id: string, archived: boolean): Promise<Result<Project>>;
    remove(id: string): Promise<Result<null>>;
  };
  entries: {
    list(query: EntryQuery): Promise<Result<TimeEntry[]>>;
    create(input: ManualEntryInput): Promise<Result<TimeEntry>>;
    update(input: EntryUpdateInput): Promise<Result<TimeEntry>>;
    remove(id: string): Promise<Result<null>>;
  };
  timer: {
    get(): Promise<Result<TimerState>>;
    start(input: StartTimerInput): Promise<Result<TimerState>>;
    stop(): Promise<Result<TimerState>>;
    toggleLast(): Promise<Result<TimerState>>;
    setPomodoro(enabled: boolean): Promise<Result<TimerState>>;
    skipBreak(): Promise<Result<TimerState>>;
    onState(listener: (state: TimerState) => void): Unsubscribe;
  };
  reports: {
    get(query: EntryQuery): Promise<Result<Report>>;
    exportCsv(query: EntryQuery): Promise<Result<ExportCsvResult>>;
  };
  settings: {
    get(): Promise<Result<Settings>>;
    update(patch: SettingsPatch): Promise<Result<Settings>>;
    onChange(listener: (settings: Settings) => void): Unsubscribe;
  };
  system: {
    info(): Promise<Result<SystemInfo>>;
  };
}
