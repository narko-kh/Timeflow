/*
 * ذخیره‌ی فایل با دیالوگ
 * -----------------------
 * فقط Main به فایل‌سیستم دست می‌زنه. مسیر رو کاربر تو دیالوگ انتخاب می‌کنه،
 * پس صفحه هیچ کنترلی روی مسیر نوشتن نداره.
 */
import { app, dialog, type BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileSaver, SaveTextOptions } from '../services/ports';

export class DialogFileSaver implements FileSaver {
  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  async saveText(o: SaveTextOptions): Promise<string | null> {
    const win = this.getWindow();
    const options = {
      title: o.title,
      defaultPath: path.join(app.getPath('documents'), o.defaultName),
      filters: [{ name: o.filterName, extensions: [o.extension] }],
    };
    const res = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options);
    if (res.canceled || !res.filePath) return null;

    let target = res.filePath;
    if (path.extname(target).toLowerCase() !== `.${o.extension}`) target += `.${o.extension}`;
    await fs.writeFile(target, o.content, 'utf8');
    return target;
  }
}
