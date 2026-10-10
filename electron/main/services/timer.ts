/*
 * سرویس تایمر
 * ------------
 * قلب برنامه: شروع/توقف، جابه‌جایی بین پروژه‌ها، Pomodoro، تشخیص بیکاری،
 * ضربان (heartbeat) و بازیابی بعد از کرش.
 *
 * هیچ وابستگی به Electron نداره: ساعت، بیکاری و اعلان همه تزریق می‌شن،
 * پس تو تست با ساعت جعلی کامل قابل کنترله.
 * قانون‌ها:
 *  - حداکثر یک تایمر فعال؛ شروع جدید قبلی رو می‌بنده (تو یک تراکنش)
 *  - ثبت کمتر از ۱ ثانیه ذخیره نمی‌شه (حذف می‌شه)
 *  - هر ۳۰ ثانیه ضربان ذخیره می‌شه؛ بعد از کرش تا آخرین ضربان بسته می‌شه
 */
import * as pomodoro from '@shared/pomodoro';
import { pomodoroConfigFrom } from '@shared/settings';
import type {
  ActiveTimer,
  EntrySource,
  PomodoroState,
  StartTimerInput,
  TimeEntry,
  TimerState,
} from '@shared/types';
import type { Database } from '../db/client';
import { AppError } from '../errors';
import type { EntriesRepo } from '../repositories/entries';
import type { ProjectsRepo } from '../repositories/projects';
import type { SettingsRepo } from '../repositories/settings';
import type { Clock, IdleProvider, Notifier } from './ports';
import type { SettingsService } from './settings';

export const HEARTBEAT_KEY = 'meta.lastHeartbeat';
/** اگه فاصله از آخرین ضربان بیشتر از این باشه، یعنی برنامه کرش کرده */
export const CRASH_GAP_MS = 2 * 60_000;
const MIN_ENTRY_MS = 1000;

export interface TimerDeps {
  db: Database;
  entries: EntriesRepo;
  projects: ProjectsRepo;
  settingsRepo: SettingsRepo;
  settings: SettingsService;
  notifier: Notifier;
  clock: Clock;
  getIdleSeconds: IdleProvider;
}

type StateListener = (state: TimerState) => void;

export class TimerService {
  private active: ActiveTimer | null = null;
  private pomo: PomodoroState = pomodoro.reset();
  private readonly listeners = new Set<StateListener>();

  constructor(private readonly deps: TimerDeps) {}

  // ---------- راه‌اندازی ----------

  /**
   * موقع شروع برنامه صدا زده می‌شه:
   * اگه ثبت فعالی مونده باشه و از آخرین ضربان بیشتر از ۲ دقیقه گذشته باشه،
   * ثبت تو لحظه‌ی آخرین ضربان بسته و اعلان «بازیابی» داده می‌شه.
   */
  async init(): Promise<void> {
    const entry = await this.deps.entries.getActive();
    if (!entry) return;
    const now = this.deps.clock();
    const beat = await this.readHeartbeat();
    const startMs = Date.parse(entry.startedAt);
    const lastAlive = Math.max(startMs, beat ?? startMs);

    if (now - lastAlive > CRASH_GAP_MS) {
      await this.closeEntry(entry, lastAlive);
      this.deps.notifier.notify({ kind: 'recovered' });
      return;
    }

    this.active = this.toActive(entry);
    // اگه Pomodoro فعاله، دوره‌ی تمرکز رو از شروع همین ثبت بازسازی می‌کنیم
    if (entry.source === 'pomodoro' && this.deps.settings.get().pomodoroEnabled) {
      this.pomo = pomodoro.startWork(this.pomo, this.config(), startMs);
    }
    this.emit();
  }

  // ---------- وضعیت ----------

  getState(): TimerState {
    return { active: this.active, pomodoro: this.pomo };
  }

  onState(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------- عملیات اصلی ----------

  /** شروع تایمر روی یک پروژه؛ تایمر فعال قبلی (اگه باشه) بسته می‌شه */
  async start(input: StartTimerInput): Promise<TimerState> {
    const project = await this.deps.projects.get(input.projectId);
    if (!project) throw new AppError('project_invalid');
    if (project.archivedAt) throw new AppError('project_archived');

    const now = this.deps.clock();
    const nowIso = new Date(now).toISOString();
    const usePomodoro = this.deps.settings.get().pomodoroEnabled;
    const source: EntrySource = usePomodoro ? 'pomodoro' : 'timer';

    const entry = await this.deps.db.transaction(async (tx) => {
      const current = await this.deps.entries.getActive(tx);
      if (current) await this.closeEntry(current, now, tx);
      return this.deps.entries.insert(
        {
          projectId: input.projectId,
          description: input.description,
          startedAt: nowIso,
          endedAt: null,
          source,
        },
        tx,
      );
    });

    this.active = this.toActive(entry);
    this.pomo = usePomodoro ? pomodoro.startWork(this.pomo, this.config(), now) : pomodoro.reset();
    await this.writeHeartbeat(now);
    this.emit();
    return this.getState();
  }

  /** توقف تایمر در لحظه‌ی now (یا at اگه داده بشه) */
  async stop(at?: number): Promise<TimerState> {
    const entry = await this.deps.entries.getActive();
    if (entry) await this.closeEntry(entry, at ?? this.deps.clock());
    this.active = null;
    if (this.pomo.phase === 'work') this.pomo = pomodoro.idleState(this.pomo.completedWork);
    this.emit();
    return this.getState();
  }

  /**
   * میان‌بر سراسری: روشن بود خاموش کن؛ وگرنه آخرین پروژه/توضیح رو ادامه بده.
   */
  async toggleLast(): Promise<TimerState> {
    if (this.active) return this.stop();
    const last = await this.deps.entries.getLast();
    if (!last) throw new AppError('no_project');
    return this.start({ projectId: last.projectId, description: last.description });
  }

  /** روشن/خاموش کردن حالت Pomodoro (تو تنظیمات هم ذخیره می‌شه) */
  async setPomodoro(enabled: boolean): Promise<TimerState> {
    await this.deps.settings.update({ pomodoroEnabled: enabled });
    if (!enabled) {
      this.pomo = pomodoro.reset();
    } else if (this.active && this.pomo.phase === 'idle') {
      this.pomo = pomodoro.startWork(this.pomo, this.config(), this.deps.clock());
    }
    this.emit();
    return this.getState();
  }

  /** رد کردن استراحت */
  skipBreak(): TimerState {
    this.pomo = pomodoro.skipBreak(this.pomo);
    this.emit();
    return this.getState();
  }

  // ---------- هوک‌های سایر سرویس‌ها ----------

  /** اگه تایمر فعال مال این پروژه‌ست، اول بسته می‌شه (قبل از حذف/بایگانی) */
  async stopIfProject(projectId: string): Promise<void> {
    if (this.active?.projectId === projectId) await this.stop();
  }

  /** حذف ثبت فعال (کاربر ثبت در حال اجرا رو پاک کرده) */
  async discardActive(): Promise<void> {
    if (this.active) await this.deps.entries.remove(this.active.entryId);
    this.active = null;
    if (this.pomo.phase === 'work') this.pomo = pomodoro.idleState(this.pomo.completedWork);
    this.emit();
  }

  /** بعد از ویرایش پروژه/توضیح ثبت فعال، وضعیت از دیتابیس تازه می‌شه */
  async refreshActive(): Promise<void> {
    const entry = await this.deps.entries.getActive();
    this.active = entry ? this.toActive(entry) : null;
    this.emit();
  }

  /** با suspend سیستم: اگه تشخیص بیکاری روشنه، تایمر متوقف می‌شه */
  async onSuspend(): Promise<void> {
    if (this.active && this.deps.settings.get().idleDetection) await this.stop();
  }

  /** موقع خروج برنامه */
  async shutdown(): Promise<void> {
    if (this.active) await this.stop();
  }

  // ---------- کارهای دوره‌ای (از بیرون زمان‌بندی می‌شن) ----------

  /**
   * بررسی پایان مرحله‌ی Pomodoro. اگه چند مرحله عقب مونده باشیم
   * (مثلاً بعد از sleep) تا رسیدن به «الان» پشت‌سرهم جلو می‌ره.
   */
  async tick(): Promise<void> {
    const now = this.deps.clock();
    const cfg = this.config();
    for (let guard = 0; guard < 10; guard++) {
      const res = pomodoro.tick(this.pomo, cfg, now);
      if (!res.event) return;
      this.pomo = res.state;

      if (res.event.type === 'workEnded') {
        // ثبت دقیقاً در لحظه‌ی پایان تمرکز بسته می‌شه
        const entry = await this.deps.entries.getActive();
        if (entry) await this.closeEntry(entry, res.event.at);
        this.active = null;
        this.deps.notifier.notify({
          kind: 'workDone',
          breakMinutes: Math.round((res.state.endsAt! - res.state.startedAt!) / 60_000),
        });
      } else {
        this.deps.notifier.notify({ kind: 'breakDone' });
      }
      this.emit();
    }
  }

  /**
   * تشخیص بیکاری: اگه بیکاری ≥ آستانه شد، تایمر تو لحظه‌ی (now - idle) بسته می‌شه
   * تا زمان بیکاری از ثبت حذف بشه.
   */
  async checkIdle(): Promise<void> {
    const settings = this.deps.settings.get();
    if (!this.active || !settings.idleDetection) return;
    const idleSeconds = this.deps.getIdleSeconds();
    if (idleSeconds < settings.idleMinutes * 60) return;

    const now = this.deps.clock();
    const startMs = Date.parse(this.active.startedAt);
    const stopAt = Math.max(startMs, now - idleSeconds * 1000);
    await this.stop(stopAt);
    this.deps.notifier.notify({ kind: 'idleStopped', minutes: Math.round(idleSeconds / 60) });
  }

  /** ذخیره‌ی ضربان (فقط وقتی تایمر فعاله) */
  async heartbeat(): Promise<void> {
    if (this.active) await this.writeHeartbeat(this.deps.clock());
  }

  // ---------- داخلی ----------

  private config() {
    return pomodoroConfigFrom(this.deps.settings.get());
  }

  private toActive(entry: TimeEntry): ActiveTimer {
    return {
      entryId: entry.id,
      projectId: entry.projectId,
      description: entry.description,
      startedAt: entry.startedAt,
      source: entry.source,
    };
  }

  /** بستن ثبت؛ اگه کمتر از ۱ ثانیه بود حذف می‌شه */
  private async closeEntry(
    entry: TimeEntry,
    endMs: number,
    q: Parameters<EntriesRepo['close']>[2] = undefined,
  ): Promise<void> {
    const startMs = Date.parse(entry.startedAt);
    const end = Math.max(endMs, startMs);
    if (end - startMs < MIN_ENTRY_MS) {
      await this.deps.entries.remove(entry.id, q);
      return;
    }
    await this.deps.entries.close(entry.id, new Date(end).toISOString(), q);
  }

  private async readHeartbeat(): Promise<number | null> {
    const raw = await this.deps.settingsRepo.get(HEARTBEAT_KEY);
    if (typeof raw !== 'string') return null;
    const ms = Date.parse(raw);
    return Number.isNaN(ms) ? null : ms;
  }

  private async writeHeartbeat(ms: number): Promise<void> {
    await this.deps.settingsRepo.set(HEARTBEAT_KEY, new Date(ms).toISOString());
  }

  private emit(): void {
    const state = this.getState();
    for (const l of this.listeners) l(state);
  }
}
