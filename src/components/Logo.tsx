/*
 * لوگوی برنامه: ساعت‌شمار با حلقه‌ی پیشرفت (teal)
 */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="logo"
    >
      <rect width="64" height="64" rx="16" fill="var(--primary)" />
      <circle cx="32" cy="34" r="17" stroke="rgba(255,255,255,.28)" strokeWidth="5" />
      <path
        d="M32 17 A17 17 0 1 1 15.4 38.2"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M32 34 L32 25" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <rect x="28" y="8" width="8" height="5" rx="2" fill="#fff" />
    </svg>
  );
}
