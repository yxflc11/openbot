import type { ReactNode } from "react";

interface IconProps {
  children: ReactNode;
  size?: number;
}

function Icon({ children, size = 18 }: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      {children}
    </svg>
  );
}

const strokeProps = {
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.8,
};

export function OfficeIcon() {
  return (
    <Icon>
      <path d="M3.5 10.4 12 3.5l8.5 6.9v9.1a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z" {...strokeProps} />
      <path d="M8.5 20.5v-6h7v6" {...strokeProps} />
    </Icon>
  );
}

export function HashIcon() {
  return (
    <Icon size={16}>
      <path d="M9 3 7 21M17 3l-2 18M4 9h17M3 15h17" {...strokeProps} />
    </Icon>
  );
}

export function BotIcon() {
  return (
    <Icon size={17}>
      <rect x="4" y="7" width="16" height="12" rx="4" {...strokeProps} />
      <path d="M12 7V4M9 13h.01M15 13h.01M8 19v2M16 19v2" {...strokeProps} />
    </Icon>
  );
}

export function NodeIcon() {
  return (
    <Icon>
      <rect x="3" y="4" width="18" height="12" rx="2" {...strokeProps} />
      <path d="M8 20h8M12 16v4" {...strokeProps} />
    </Icon>
  );
}

export function PlusIcon() {
  return (
    <Icon size={16}>
      <path d="M12 5v14M5 12h14" {...strokeProps} />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="m6 6 12 12M18 6 6 18" {...strokeProps} />
    </Icon>
  );
}

export function CheckIcon() {
  return (
    <Icon size={14}>
      <path d="m5 12 4 4L19 6" {...strokeProps} />
    </Icon>
  );
}
