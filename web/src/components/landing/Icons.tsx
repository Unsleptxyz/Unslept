import type { ReactNode } from "react";

/** Small stroke icons drawn for Unslept. 24px grid, currentColor. */
function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const IconShield = () => (
  <Icon>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>
);
export const IconClock = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);
export const IconCheckFile = () => (
  <Icon>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
    <path d="m9 14 2 2 4-4" />
  </Icon>
);
export const IconSliders = () => (
  <Icon>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Icon>
);
export const IconKey = () => (
  <Icon>
    <circle cx="8" cy="15" r="3.5" />
    <path d="m10.5 12.5 8-8M16 7l2 2M14 9l1.5 1.5" />
  </Icon>
);
export const IconPulse = () => (
  <Icon>
    <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
  </Icon>
);
export const IconPark = () => (
  <Icon>
    <path d="M4 20V10l8-6 8 6v10" />
    <path d="M9 20v-5h6v5" />
  </Icon>
);
export const IconBolt = () => (
  <Icon>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />
  </Icon>
);
export const IconRefresh = () => (
  <Icon>
    <path d="M20 11a8 8 0 0 0-14.5-4.5M4 4v3.5h3.5" />
    <path d="M4 13a8 8 0 0 0 14.5 4.5M20 20v-3.5h-3.5" />
  </Icon>
);
export const IconLayers = () => (
  <Icon>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Icon>
);
export const IconCode = () => (
  <Icon>
    <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
  </Icon>
);
export const IconWallet = () => (
  <Icon>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
    <rect x="4" y="8" width="16" height="11" rx="2.5" />
    <circle cx="15.5" cy="13.5" r="1.2" />
  </Icon>
);
export const IconCopy = () => (
  <Icon size={16}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Icon>
);
