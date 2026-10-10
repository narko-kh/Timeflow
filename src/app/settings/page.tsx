'use client';
/*
 * صفحه‌ی تنظیمات
 * ---------------
 * هر تغییر همون لحظه ذخیره می‌شه (بدون دکمه‌ی «ذخیره»).
 * سه حالت میان‌بر: ثبت شد / ثبت نشد (پیام) / خاموش.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_CURRENCIES } from '@shared/validation';
import type { LanguageSetting, ThemeSetting } from '@shared/types';
import { PageHeader } from '@/components/PageHeader';
import { useApp } from '@/stores/app';

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange(v: boolean): void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="setting-row">
      <div>
        <div>{label}</div>
        {hint && <small className="muted">{hint}</small>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-thumb" />
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(v: number): void;
  disabled?: boolean;
}) {
  // متن تایپ‌شده جدا نگه داشته می‌شه تا کاربر بتونه فیلد رو موقتاً خالی کنه
  const fieldId = `number-${label.replace(/\s+/g, '-')}`;
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <div className="setting-row">
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        className="input input-narrow"
        type="number"
        dir="ltr"
        min={min}
        max={max}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isInteger(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => setText(String(value))}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const s = useApp((st) => st.settings);
  const system = useApp((st) => st.system);
  const update = useApp((st) => st.updateSettings);

  const languages: Array<{ id: LanguageSetting; label: string }> = [
    { id: 'system', label: t('settings.languageSystem') },
    { id: 'en', label: 'English' },
    { id: 'fa', label: 'فارسی' },
  ];
  const themes: Array<{ id: ThemeSetting; label: string }> = [
    { id: 'system', label: t('settings.themeSystem') },
    { id: 'light', label: t('settings.themeLight') },
    { id: 'dark', label: t('settings.themeDark') },
  ];

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <section className="card settings-group">
        <h2>{t('settings.general')}</h2>
        <div className="setting-row">
          <span id="lang-label">{t('settings.language')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby="lang-label">
            {languages.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={s.language === l.id}
                className={s.language === l.id ? 'is-active' : ''}
                onClick={() => void update({ language: l.id })}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span id="theme-label">{t('settings.theme')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby="theme-label">
            {themes.map((x) => (
              <button
                key={x.id}
                role="radio"
                aria-checked={s.theme === x.id}
                className={s.theme === x.id ? 'is-active' : ''}
                onClick={() => void update({ theme: x.id })}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div>
            <label htmlFor="currency">{t('settings.currency')}</label>
            <br />
            <small className="muted">{t('settings.currencyHint')}</small>
          </div>
          <select
            id="currency"
            className="input input-narrow"
            value={s.currency}
            onChange={(e) => void update({ currency: e.target.value })}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card settings-group">
        <h2>{t('settings.tracking')}</h2>
        <Switch
          label={t('settings.idleDetection')}
          hint={t('settings.idleDetectionHint')}
          checked={s.idleDetection}
          onChange={(v) => void update({ idleDetection: v })}
        />
        <NumberField
          label={t('settings.idleMinutes')}
          value={s.idleMinutes}
          min={1}
          max={240}
          disabled={!s.idleDetection}
          onChange={(v) => void update({ idleMinutes: v })}
        />
      </section>

      <section className="card settings-group">
        <h2>{t('settings.pomodoro')}</h2>
        <Switch
          label={t('settings.pomodoroEnabled')}
          checked={s.pomodoroEnabled}
          onChange={(v) => void update({ pomodoroEnabled: v })}
        />
        <NumberField label={t('settings.pomodoroWork')} value={s.pomodoroWorkMinutes} min={1} max={180} onChange={(v) => void update({ pomodoroWorkMinutes: v })} />
        <NumberField label={t('settings.pomodoroShort')} value={s.pomodoroShortBreakMinutes} min={1} max={60} onChange={(v) => void update({ pomodoroShortBreakMinutes: v })} />
        <NumberField label={t('settings.pomodoroLong')} value={s.pomodoroLongBreakMinutes} min={1} max={120} onChange={(v) => void update({ pomodoroLongBreakMinutes: v })} />
        <NumberField label={t('settings.pomodoroEvery')} value={s.pomodoroLongEvery} min={2} max={12} onChange={(v) => void update({ pomodoroLongEvery: v })} />
      </section>

      <section className="card settings-group">
        <h2>{t('settings.desktop')}</h2>
        <Switch
          label={t('settings.closeToTray')}
          hint={t('settings.closeToTrayHint')}
          checked={s.closeToTray}
          onChange={(v) => void update({ closeToTray: v })}
        />
        {system && !system.trayAvailable && <p className="notice">{t('settings.trayMissing')}</p>}
        <Switch
          label={t('settings.shortcutEnabled')}
          hint={system ? system.shortcut.accelerator.replace('CommandOrControl', system.platform === 'darwin' ? 'Cmd' : 'Ctrl') : undefined}
          checked={s.shortcutEnabled}
          onChange={(v) => void update({ shortcutEnabled: v })}
        />
        {system && s.shortcutEnabled && (
          <p className={system.shortcut.registered ? 'ok-text' : 'notice'} role="status">
            {system.shortcut.registered ? t('settings.shortcutOk') : t('settings.shortcutFailed')}
          </p>
        )}
      </section>

      <section className="card settings-group">
        <h2>{t('settings.about')}</h2>
        <div className="setting-row">
          <span>{t('settings.version')}</span>
          <span dir="ltr">{system?.appVersion ?? '—'}</span>
        </div>
        <div className="setting-row">
          <span>{t('settings.dataFolder')}</span>
          <code dir="ltr" className="path">
            {system?.dataPath ?? '—'}
          </code>
        </div>
        <p className="muted">{t('settings.desktopOnly')}</p>
        <p className="muted">{t('settings.madeBy')}</p>
      </section>
    </>
  );
}
