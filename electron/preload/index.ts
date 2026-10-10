/*
 * Preload — پل امن بین Renderer و Main
 * -------------------------------------
 * فقط contextBridge.exposeInMainWorld('api', ...) با تابع‌های مشخص.
 * ipcRenderer خام هیچ‌وقت به صفحه نمی‌رسه. هیچ منطقی اینجا نیست، فقط عبور پیام.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { TimeFlowApi, Unsubscribe } from '../../src/shared/api';
import { Channels } from '../../src/shared/channels';

const invoke = <T>(channel: string, arg?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, arg) as Promise<T>;

/** اشتراک در رویداد Main→Renderer؛ تابع لغو برمی‌گردونه */
function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const wrapped = (_e: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
}

const api: TimeFlowApi = {
  projects: {
    list: () => invoke(Channels.projectsList),
    create: (input) => invoke(Channels.projectsCreate, input),
    update: (id, input) => invoke(Channels.projectsUpdate, { id, input }),
    setArchived: (id, archived) => invoke(Channels.projectsSetArchived, { id, archived }),
    remove: (id) => invoke(Channels.projectsRemove, id),
  },
  entries: {
    list: (query) => invoke(Channels.entriesList, query),
    create: (input) => invoke(Channels.entriesCreate, input),
    update: (input) => invoke(Channels.entriesUpdate, input),
    remove: (id) => invoke(Channels.entriesRemove, id),
  },
  timer: {
    get: () => invoke(Channels.timerGet),
    start: (input) => invoke(Channels.timerStart, input),
    stop: () => invoke(Channels.timerStop),
    toggleLast: () => invoke(Channels.timerToggleLast),
    setPomodoro: (enabled) => invoke(Channels.timerSetPomodoro, enabled),
    skipBreak: () => invoke(Channels.timerSkipBreak),
    onState: (listener) => subscribe(Channels.timerState, listener),
  },
  reports: {
    get: (query) => invoke(Channels.reportsGet, query),
    exportCsv: (query) => invoke(Channels.reportsExportCsv, query),
  },
  settings: {
    get: () => invoke(Channels.settingsGet),
    update: (patch) => invoke(Channels.settingsUpdate, patch),
    onChange: (listener) => subscribe(Channels.settingsChanged, listener),
  },
  system: {
    info: () => invoke(Channels.systemInfo),
  },
};

contextBridge.exposeInMainWorld('api', api);
