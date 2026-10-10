/*
 * استور اصلی برنامه (Zustand)
 * ----------------------------
 * تنظیمات، وضعیت تایمر، پروژه‌ها و Toastها اینجا هستن.
 * همه‌ی ارتباط با Main از طریق window.api انجام می‌شه و فقط داخل رویدادها/افکت‌ها صدا زده می‌شه.
 */
import { defaultSettings } from '@shared/settings';
import { resolveLanguage } from '@shared/settings';
import { idleState } from '@shared/pomodoro';
import type {
  ErrorCode,
  Language,
  ProjectWithStats,
  Result,
  Settings,
  SettingsPatch,
  SystemInfo,
  TimerState,
} from '@shared/types';
import { create } from 'zustand';

export interface Toast {
  id: number;
  kind: 'error' | 'success';
  /** کلید ترجمه */
  key: string;
}

interface AppState {
  ready: boolean;
  failed: boolean;
  /** وقتی صفحه بیرون از Electron باز شده */
  noBridge: boolean;
  settings: Settings;
  system: SystemInfo | null;
  lang: Language;
  timer: TimerState;
  projects: ProjectWithStats[];
  toasts: Toast[];

  init(): Promise<void>;
  refreshProjects(): Promise<void>;
  refreshSystem(): Promise<void>;
  updateSettings(patch: SettingsPatch): Promise<void>;
  /** نتیجه‌ی IPC رو باز می‌کنه؛ خطا = Toast و null */
  run<T>(promise: Promise<Result<T>>): Promise<T | null>;
  toastError(code: ErrorCode | string): void;
  toastSuccess(key: string): void;
  dismissToast(id: number): void;
}

let toastId = 0;
let initialized = false;

const emptyTimer: TimerState = { active: null, pomodoro: idleState() };

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  failed: false,
  noBridge: false,
  settings: defaultSettings('win32'),
  system: null,
  lang: 'en',
  timer: emptyTimer,
  projects: [],
  toasts: [],

  async init() {
    if (initialized) return;
    initialized = true;
    const api = window.api;
    if (!api) {
      set({ noBridge: true, ready: true });
      return;
    }
    try {
      const [settings, system, timer, projects] = await Promise.all([
        api.settings.get(),
        api.system.info(),
        api.timer.get(),
        api.projects.list(),
      ]);
      if (!settings.ok || !system.ok || !timer.ok || !projects.ok) throw new Error('init');
      set({
        settings: settings.data,
        system: system.data,
        lang: resolveLanguage(settings.data.language, system.data.locale),
        timer: timer.data,
        projects: projects.data,
        ready: true,
      });
    } catch {
      set({ failed: true, ready: true });
      return;
    }

    // رویدادهای زنده از Main
    api.timer.onState((state) => {
      set({ timer: state });
      void get().refreshProjects();
    });
    api.settings.onChange((settings) => {
      const system = get().system;
      set({
        settings,
        lang: resolveLanguage(settings.language, system?.locale ?? 'en'),
      });
      void get().refreshSystem();
    });
  },

  async refreshProjects() {
    const res = await window.api?.projects.list();
    if (res?.ok) set({ projects: res.data });
  },

  async refreshSystem() {
    const res = await window.api?.system.info();
    if (res?.ok) set({ system: res.data });
  },

  async updateSettings(patch) {
    // خوش‌بینانه: فوراً تو UI اعمال می‌شه و اگه Main رد کرد برمی‌گرده
    const before = get().settings;
    set({ settings: { ...before, ...patch } });
    const res = await window.api?.settings.update(patch);
    if (!res || !res.ok) {
      set({ settings: before });
      if (res && !res.ok) get().toastError(res.code);
    }
  },

  async run<T>(promise: Promise<Result<T>>): Promise<T | null> {
    try {
      const res = await promise;
      if (res.ok) return res.data;
      get().toastError(res.code);
      return null;
    } catch {
      get().toastError('internal');
      return null;
    }
  },

  toastError(code) {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, kind: 'error', key: `errors.${code}` }] }));
    setTimeout(() => get().dismissToast(id), 5000);
  },

  toastSuccess(key) {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, kind: 'success', key }] }));
    setTimeout(() => get().dismissToast(id), 3500);
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
