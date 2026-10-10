/*
 * منوی برنامه
 * ------------
 * فقط روی macOS منو داریم (لازمه که copy/paste و Cmd+Q کار کنه).
 * روی ویندوز و لینوکس null می‌شه تا نوار منوی اضافه نیاد.
 */
import { Menu } from 'electron';

export function setupAppMenu(platform: NodeJS.Platform): void {
  if (platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]),
    );
  } else {
    Menu.setApplicationMenu(null);
  }
}
