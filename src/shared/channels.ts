/*
 * نام کانال‌های IPC
 * ------------------
 * یک جا نگه می‌داریم که Main و Preload هیچ‌وقت از هم جدا نشن.
 */
export const Channels = {
  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  projectsUpdate: 'projects:update',
  projectsSetArchived: 'projects:setArchived',
  projectsRemove: 'projects:remove',

  entriesList: 'entries:list',
  entriesCreate: 'entries:create',
  entriesUpdate: 'entries:update',
  entriesRemove: 'entries:remove',

  timerGet: 'timer:get',
  timerStart: 'timer:start',
  timerStop: 'timer:stop',
  timerToggleLast: 'timer:toggleLast',
  timerSetPomodoro: 'timer:setPomodoro',
  timerSkipBreak: 'timer:skipBreak',
  /** رویداد Main → Renderer */
  timerState: 'timer:state',

  reportsGet: 'reports:get',
  reportsExportCsv: 'reports:exportCsv',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  /** رویداد Main → Renderer */
  settingsChanged: 'settings:changed',

  systemInfo: 'system:info',
} as const;
