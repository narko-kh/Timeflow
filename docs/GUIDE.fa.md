<div dir="rtl">

# راهنمای فارسی TimeFlow

از اجرای پروژه تا دیتابیس تا نصب روی ویندوز، مک و لینوکس. همه‌ی دستورها قابل کپی-پیست هستن.

> ⚠️ **نکته‌ی مهم:** TimeFlow یک برنامه‌ی **دسکتاپ** (Electron) است و فقط روی **Windows، macOS و Linux** کار می‌کنه.
> روی **Android، iOS و تبلت پشتیبانی نمی‌شه** و اجرا هم نمی‌شه.

## ۱. پیش‌نیازها

| | Windows 10/11 | macOS 12+ | Linux (Ubuntu/Debian/Fedora) |
|---|---|---|---|
| Node.js 22+ | [nodejs.org](https://nodejs.org) (LTS) | `brew install node@22` | `nvm install 22` یا بسته‌ی توزیع |
| Git | [git-scm.com](https://git-scm.com) | `xcode-select --install` یا `brew install git` | `sudo apt install git` |

بررسی نسخه‌ها:

```bash
node -v    # باید v22 یا بالاتر باشه
git --version
```

**Visual Studio / Xcode / کامپایلر لازم نیست.** این پروژه ماژول native نداره (دیتابیس PGlite داخل WebAssembly اجرا می‌شه)، پس فقط Node و Git کافیه. Xcode Command Line Tools فقط برای خود `git` روی مک لازم می‌شه.

## ۲. اجرای پروژه (توسعه)

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/timeflow.git
cd timeflow
npm ci
npm run dev
```

بعد از چند ثانیه پنجره‌ی TimeFlow باز می‌شه. تغییر تو کد صفحه‌ها (`src/`) فوری تو پنجره دیده می‌شه.
اگه کد Main یا Preload (`electron/`) رو عوض کردی، `npm run dev` رو ببند و دوباره اجرا کن.

> اگه `npm` موقع نصب درباره‌ی «install scripts» سؤال کرد: لیست تأییدشده‌ها از قبل تو `package.json` (بخش `allowScripts`) هست.
> اگه بعد از نصب خطای «Electron failed to install correctly» گرفتی:
> ```bash
> node node_modules/electron/install.js
> ```

## ۳. ساخت و تست

```bash
npm run typecheck     # بررسی تایپ‌ها (strict)
npm test              # تست‌ها (روی PostgreSQL واقعی داخل حافظه)
npm run build         # خروجی استاتیک Next + باندل Electron
npm start             # اجرای نسخه‌ی ساخته‌شده
npm run e2e           # تست واقعی با Playwright (اول npm run build)
```

روی لینوکس بدون نمایشگر (سرور/CI) تست e2e رو این‌طوری اجرا کن:

```bash
sudo apt install -y xvfb
xvfb-run -a npm run e2e
```

## ۴. دیتابیس

### چطور کار می‌کنه
TimeFlow از **PostgreSQL واقعی** استفاده می‌کنه، ولی از طریق **PGlite** که Postgres رو روی WebAssembly داخل خود برنامه اجرا می‌کنه. یعنی:

- کاربر هیچ چیزی جدا نصب نمی‌کنه و هیچ سرور یا پورتی باز نمی‌شه.
- همه‌چیز آفلاین و فقط روی کامپیوتر خودته.
- فقط پروسه‌ی Main به دیتابیس دست می‌زنه؛ صفحه فقط از راه IPC درخواست می‌ده.

### محل فایل‌ها

| سیستم‌عامل | پوشه‌ی داده | پوشه‌ی دیتابیس |
|---|---|---|
| Windows | `%APPDATA%\TimeFlow` | `%APPDATA%\TimeFlow\database` |
| macOS | `~/Library/Application Support/TimeFlow` | `…/TimeFlow/database` |
| Linux | `~/.config/TimeFlow` | `~/.config/TimeFlow/database` |

مسیر دقیق رو تو **تنظیمات ← درباره ← پوشه‌ی داده‌ها** هم می‌بینی.

### بکاپ
۱. برنامه رو کامل ببند (از tray هم **خروج** بزن).
۲. پوشه‌ی `database` رو کپی کن جای امن.

برای برگردوندن بکاپ: برنامه رو ببند، پوشه‌ی `database` فعلی رو با نسخه‌ی بکاپ عوض کن.

### ریست (پاک کردن همه‌ی داده‌ها)
برنامه رو ببند و پوشه‌ی `database` رو حذف کن. دفعه‌ی بعد دیتابیس خالی و تازه ساخته می‌شه.

```bash
# Linux
rm -rf ~/.config/TimeFlow/database
# macOS
rm -rf ~/Library/Application\ Support/TimeFlow/database
```

```powershell
# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:APPDATA\TimeFlow\database"
```

### مهاجرت‌ها (migrations)
- فایل: `electron/main/db/migrations.ts`
- هر مهاجرت یک `id` یکتا داره (مثل `001_init`) و **فقط یک بار** و داخل یک تراکنش اجرا می‌شه.
- لیست اجراشده‌ها تو جدول `schema_migrations` نگه داشته می‌شه.
- برای تغییر ساختار، **مهاجرت جدید** اضافه کن (مثلاً `002_...`) و قدیمی‌ها رو دست نزن.

### مشاهده‌ی داده
دیتابیس یک Postgres واقعیه، ولی برای باز کردنش لازم نیست ابزار جدا نصب کنی:

- **ساده‌ترین راه:** از برنامه، **گزارش‌ها ← خروجی CSV** و بازش کن تو Excel/Sheets.
- **اجرای SQL دلخواه** (برنامه رو ببند، بعد):

```bash
node -e "
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const db = await PGlite.create(process.argv[1]);
  const r = await db.query('SELECT p.name, e.description, e.started_at, e.ended_at FROM time_entries e JOIN projects p ON p.id = e.project_id ORDER BY e.started_at DESC LIMIT 20');
  console.table(r.rows);
  await db.close();
})();
" "<مسیر پوشه‌ی database>"
```

> ⚠️ هم‌زمان با باز بودن برنامه این کار رو نکن؛ PGlite تک‌اتصاله و فقط یک پروسه باید دیتابیس رو باز کنه.

## ۵. ساخت نصب‌کننده

هر نصب‌کننده رو باید روی **همون سیستم‌عامل** ساخت (یا از CI استفاده کنی).

### محلی

```bash
npm ci
npm run dist:win     # روی Windows  → release/TimeFlow-1.0.0-win-x64.exe
npm run dist:mac     # روی macOS    → release/*.dmg (x64 و arm64)
npm run dist:linux   # روی Linux    → release/*.AppImage و *.deb
```

اگه می‌خوای ایمیل maintainer بسته‌ی `deb` درست باشه، `electron-builder.yml` رو باز کن و `maintainer: Narko <narkokh022@gmail.com>` رو با ایمیل خودت عوض کن.

### با GitHub Actions (توصیه‌شده)

۱. پروژه رو تو GitHub بذار (`YOUR_GITHUB_USERNAME` رو با اسم کاربری خودت عوض کن):

```bash
git remote add origin https://github.com/narko-kh/timeflow.git
git push -u origin main
```

۲. یک تگ بزن و push کن:

```bash
git tag v1.0.0
git push origin v1.0.0
```

۳. تو تب **Actions** منتظر بمون سه job (Linux / Windows / macOS) تموم بشن. نصب‌کننده‌ها هم تو **Artifacts** هستن، هم به‌صورت خودکار به **Releases** اضافه می‌شن.

برای ساخت بدون تگ: Actions ← Release ← **Run workflow**.

## ۶. نصب و حذف

نصب‌کننده‌ها **امضا نشدن**، پس بار اول هر سیستم‌عامل هشدار می‌ده. این طبیعیه و راه رد شدنش پایینه.

### Windows (x64)
۱. فایل `TimeFlow-<نسخه>-win-x64.exe` رو اجرا کن.
۲. اگه SmartScreen آبی اومد: **More info** ← **Run anyway**.
۳. مسیر نصب رو انتخاب کن و **Install** بزن. میانبر دسکتاپ ساخته می‌شه.

حذف: **Settings ← Apps ← TimeFlow ← Uninstall**. (داده‌ها تو `%APPDATA%\TimeFlow` می‌مونن؛ اگه می‌خوای پاک بشن خودت حذفش کن.)

### macOS (Intel x64 و Apple Silicon arm64)
۱. فایل مناسب رو بردار: `…-mac-arm64.dmg` برای M1/M2/M3/M4، و `…-mac-x64.dmg` برای Intel.
۲. دو بار کلیک کن و TimeFlow رو بکش تو **Applications**.
۳. بار اول: روی برنامه **راست‌کلیک ← Open ← Open**. اگه نشد:

```bash
xattr -dr com.apple.quarantine /Applications/TimeFlow.app
```

حذف: برنامه رو از Applications به سطل زباله بکش. داده‌ها: `~/Library/Application Support/TimeFlow`.

### Linux (x64)
**AppImage** (بدون نصب):

```bash
chmod +x TimeFlow-*-linux-x64.AppImage
./TimeFlow-*-linux-x64.AppImage
```

**deb** (Ubuntu/Debian):

```bash
sudo apt install ./TimeFlow-*-linux-x64.deb
# حذف
sudo apt remove timeflow
```

> برای معماری **arm64 روی لینوکس** نصب‌کننده‌ی آماده نمی‌سازیم (فقط x64). روی ARM باید از سورس اجرا کنی (`npm ci && npm run dev`).

## ۷. عیب‌یابی

| مشکل | راه‌حل |
|---|---|
| **پورت ۳۰۰۰ اشغاله** (`EADDRINUSE`) | برنامه‌ی دیگه‌ای روی ۳۰۰۰ هست. ببندش، یا روی ویندوز: `netstat -ano \| findstr :3000` و بعد `taskkill /PID <شماره> /F`؛ روی مک/لینوکس: `lsof -i :3000` و `kill <PID>`. |
| **صفحه‌ی سفید بعد از `npm start`** | احتمالاً پوشه‌ی `out` ساخته نشده. اول `npm run build` رو اجرا کن و مطمئن شو پوشه‌ی `out/` وجود داره و `out/index.html` تو اون هست. |
| **صفحه‌ی سفید تو نسخه‌ی نصب‌شده** | `Ctrl+Shift+I` رو بزن (یا از طریق `npm start` اجرا کن) و Console رو ببین. معمولاً علتش ساخته نشدن `out` قبل از `electron-builder` بوده؛ `npm run dist` خودش اول build می‌گیره. |
| **AppImage روی Ubuntu 24.04 باز نمی‌شه** (خطای sandbox) | Ubuntu 24.04 ساخت sandbox بدون دسترسی root رو محدود می‌کنه. یا از `.deb` استفاده کن، یا: `./TimeFlow-*.AppImage --no-sandbox`، یا موقتاً: `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`. |
| **میان‌بر سراسری یا تشخیص بیکاری روی Wayland کار نمی‌کنه** | Wayland اجازه‌ی میان‌بر سراسری و خوندن زمان بیکاری رو به برنامه‌ها نمی‌ده. برنامه رو با `--ozone-platform=x11` اجرا کن یا با سشن X11 وارد شو. تو تنظیمات پیغام «ثبت نشد» نشون داده می‌شه. |
| **آیکون tray تو GNOME نیست** | GNOME به‌صورت پیش‌فرض tray نداره. افزونه‌ی **AppIndicator and KStatusNotifierItem Support** رو نصب و فعال کن. تا اون موقع گزینه‌ی «ادامه در tray» رو خاموش نگه دار تا پنجره بسته بشه (پیش‌فرض لینوکس خاموشه). |
| **نصب‌کننده ساخته/چاپ نمی‌شه** (`electron-builder` خروجی نمی‌ده) | ۱) از `npm run dist:<os>` روی همون سیستم‌عامل استفاده کن؛ ۲) مطمئن شو `npm run build` بدون خطا تموم می‌شه؛ ۳) پوشه‌ی `release/` رو ببین (فایل‌ها اونجا هستن، نه تو ریشه)؛ ۴) اینترنت لازمه چون electron-builder بار اول ابزارهای ساخت (NSIS و ...) رو دانلود می‌کنه؛ ۵) `rm -rf release node_modules && npm ci` و دوباره. |
| **`Electron failed to install correctly`** | `node node_modules/electron/install.js` |
| **ویندوز: «file is in use» موقع حذف پوشه‌ی داده** | برنامه هنوز تو tray بازه. از tray **Quit** بزن، بعد پوشه رو پاک کن. |

## ۸. چند نکته‌ی کاربردی

- **میان‌بر سراسری:** `Ctrl+Alt+T` (روی مک `Cmd+Alt+T`) تایمر آخرین پروژه رو روشن/خاموش می‌کنه.
- **بستن پنجره:** روی ویندوز برنامه تو tray می‌مونه؛ روی مک پنجره فقط مخفی می‌شه؛ روی لینوکس پیش‌فرض بسته می‌شه (از تنظیمات عوض می‌شه).
- **بیکاری:** اگه بیشتر از N دقیقه (پیش‌فرض ۵) دور از کامپیوتر باشی، تایمر خودکار متوقف می‌شه و **زمان بیکاری از ثبت حذف می‌شه**.
- **بعد از کرش:** تایمر تا آخرین ضربان (هر ۳۰ ثانیه) ذخیره می‌شه و موقع باز شدن دوباره بهت خبر داده می‌شه.

</div>
