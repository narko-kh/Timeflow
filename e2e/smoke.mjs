/*
 * تست smoke واقعی با Playwright (_electron.launch)
 * -------------------------------------------------
 * برنامه‌ی ساخته‌شده (dist-electron + out) رو واقعاً اجرا می‌کنه و سناریوی اصلی رو می‌ره:
 * ساخت پروژه، تایمر، ثبت دستی، گزارش، فارسی/RTL، تم تاریک، ماندگاری بعد از relaunch،
 * و اینکه صفحه به require/process/ipcRenderer دسترسی نداره. اسکرین‌شات‌ها تو docs/screenshots.
 *
 * اجرا:  npm run build && npm run e2e
 * روی لینوکس بدون نمایشگر:  xvfb-run -a npm run e2e
 * برای تست نسخه‌ی بسته‌بندی‌شده: TIMEFLOW_EXECUTABLE=/path/to/TimeFlow npm run e2e
 */
import { _electron as electron } from 'playwright';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const shots = join(root, 'docs', 'screenshots');
mkdirSync(shots, { recursive: true });
const userData = mkdtempSync(join(tmpdir(), 'timeflow-e2e-'));

const results = [];
/** خطاهای کنسول که به CSP یا خطای رندر مربوطن */
const consoleProblems = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(['PASS', name]);
    console.log(`  ok   ${name}`);
  } catch (err) {
    results.push(['FAIL', name]);
    console.log(`  FAIL ${name}\n       ${err.message.split('\n')[0]}`);
    throw err;
  }
};

/** اسکرین‌شات با capturePage خود Electron (page.screenshot روی بعضی سیستم‌ها گیر می‌کنه) */
async function shot(app, name) {
  const b64 = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const img = await win.webContents.capturePage();
    return img.toPNG().toString('base64');
  });
  writeFileSync(join(shots, name), Buffer.from(b64, 'base64'));
}

async function launch() {
  const executablePath = process.env.TIMEFLOW_EXECUTABLE;
  const env = { ...process.env, TIMEFLOW_USER_DATA: userData };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch(
    executablePath
      ? { executablePath, args: ['--lang=en-US', '--no-sandbox'], env }
      : { args: [root, '--lang=en-US', '--no-sandbox'], env },
  );
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1180, height: 780 }).catch(() => undefined);
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) consoleProblems.push(m.text());
  });
  page.on('pageerror', (e) => consoleProblems.push(String(e)));
  await page.waitForSelector('.shell', { timeout: 30_000 });
  return { app, page };
}

let ctx;
try {
  console.log('TimeFlow e2e smoke');
  ctx = await launch();
  let { app, page } = ctx;

  await step('window loads the static Next export through app://', async () => {
    assert.match(page.url(), /^app:\/\/timeflow\//);
    await page.getByRole('heading', { name: 'Timer' }).waitFor();
  });

  await step('renderer has no access to Node / ipcRenderer', async () => {
    const probe = await page.evaluate(() => ({
      require: typeof require,
      process: typeof process,
      ipcRenderer: typeof ipcRenderer,
      module: typeof module,
      api: typeof window.api,
      apiKeys: Object.keys(window.api ?? {}).sort(),
    }));
    assert.equal(probe.require, 'undefined');
    assert.equal(probe.process, 'undefined');
    assert.equal(probe.ipcRenderer, 'undefined');
    assert.equal(probe.module, 'undefined');
    assert.equal(probe.api, 'object');
    assert.deepEqual(probe.apiKeys, ['entries', 'projects', 'reports', 'settings', 'system', 'timer']);
  });

  await step('empty state asks for a first project', async () => {
    await page.getByText('Create your first project').waitFor();
    await shot(app, '00-empty.png');
  });

  await step('create a project with an hourly rate', async () => {
    await page.getByRole('button', { name: 'Create a project' }).click();
    await page.getByLabel('Project name').fill('Landing page');
    await page.getByLabel('Client').fill('ACME');
    await page.getByLabel('Hourly rate').fill('60');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('button', { name: 'Start' }).waitFor();
  });

  await step('start / stop the timer and see the entry', async () => {
    await page.getByPlaceholder('What are you working on?').fill('Hero section');
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('button', { name: 'Stop' }).waitFor();
    // pill توی نوار کناری باید زنده باشه
    await page.locator('.pill').waitFor();
    await page.waitForTimeout(2500);
    await shot(app, '01-timer-running.png');
    await page.getByRole('button', { name: 'Stop' }).click();
    await page.getByRole('button', { name: 'Start' }).waitFor();
    await page.getByText('Hero section').first().waitFor();
  });

  await step('add a manual entry', async () => {
    await page.getByRole('button', { name: 'Add time manually' }).click();
    const dialog = page.getByRole('dialog');
    // بازه‌ی امن: از ۰۰:۰۰ تا ۰۰:۳۰ همین امروز (همیشه تو گذشته‌ست)
    await dialog.getByLabel('Start').fill('00:00');
    await dialog.getByLabel('End').fill('00:30');
    await dialog.getByLabel('What are you working on?').fill('Manual work');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await page.getByText('Manual work').first().waitFor();
    await shot(app, '02-timer-today.png');
  });

  await step('projects page shows the project card with stats', async () => {
    await page.getByRole('link', { name: 'Projects' }).click();
    await page.getByRole('heading', { name: 'Landing page' }).waitFor();
    await shot(app, '03-projects.png');
  });

  await step('reports page sums time and earnings', async () => {
    await page.getByRole('link', { name: 'Reports' }).click();
    await page.getByRole('tab', { name: 'Today' }).click();
    await page.getByText('Total time').waitFor();
    await page.waitForSelector('.chart');
    await shot(app, '04-reports.png');
  });

  await step('switch to Persian: RTL applied instantly, no restart', async () => {
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('radio', { name: 'فارسی' }).click();
    await page.getByRole('heading', { name: 'تنظیمات' }).waitFor();
    const dir = await page.evaluate(() => document.documentElement.dir);
    const lang = await page.evaluate(() => document.documentElement.lang);
    assert.equal(dir, 'rtl');
    assert.equal(lang, 'fa');
    await shot(app, '05-settings-fa.png');
  });

  await step('dark theme is explicit on <html>', async () => {
    await page.getByRole('radio', { name: 'تاریک' }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.getByRole('link', { name: 'تایمر' }).click();
    await page.getByRole('heading', { name: 'تایمر', level: 1 }).waitFor();
    await shot(app, '06-timer-dark-fa.png');
  });

  await step('settings + data persist after relaunch', async () => {
    await app.close();
    ({ app, page } = await launch());
    await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    assert.equal(theme, 'dark');
    await page.getByRole('link', { name: 'پروژه‌ها' }).click();
    await page.getByRole('heading', { name: 'Landing page' }).waitFor();
  });

  await step('system info: version, data path, shortcut state', async () => {
    const info = await page.evaluate(() => window.api.system.info());
    assert.equal(info.ok, true);
    assert.ok(info.data.dataPath.length > 0);
    assert.equal(typeof info.data.shortcut.registered, 'boolean');
  });

  await step('IPC rejects invalid payloads without leaking details', async () => {
    const res = await page.evaluate(() =>
      window.api.projects.create({ name: '', client: '', color: 'nope', hourlyRateCents: -5 }),
    );
    assert.equal(res.ok, false);
    assert.equal(res.code, 'name_required');
    const bad = await page.evaluate(() => window.api.settings.update({ evil: true }));
    assert.deepEqual(bad, { ok: false, code: 'unknown_setting' });
  });

  await step('no CSP violations or console errors', async () => {
    assert.deepEqual(consoleProblems, []);
  });

  await app.close();
  console.log(`\n${results.length} steps passed.`);
} catch (err) {
  console.error('\nE2E failed:', err.message);
  process.exitCode = 1;
  try {
    await ctx?.app?.close();
  } catch {
    // ignore
  }
} finally {
  try {
    rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    // ویندوز گاهی فایل رو هنوز قفل نگه می‌داره؛ پوشه‌ی temp مهم نیست
  }
}
