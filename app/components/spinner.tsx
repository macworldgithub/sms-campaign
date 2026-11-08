import React from "react";

export interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  color?: string;
  trackColor?: string;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}

const SIZES: Record<string, number> = {
  xs: 14,
  sm: 18,
  md: 26,
  lg: 40,
  xl: 56,
};

export function Spinner({
  size = "md",
  color = "var(--red, #e22837)",
  trackColor = "rgba(226, 40, 55, 0.15)",
  className = "",
  style,
  label,
}: SpinnerProps) {
  const pixelSize = typeof size === "number" ? size : SIZES[size] || 26;
  const strokeWidth = pixelSize <= 16 ? 3 : pixelSize <= 28 ? 3.5 : 4;
  const radius = 20;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={`theme-spinner-wrap ${className}`}
      style={{
        display: "inline-flex",
        flexDirection: label ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: label ? 10 : 6,
        ...style,
      }}
      role="status"
      aria-label={label || "Loading"}
    >
      <svg
        className="theme-spinner-svg"
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 50 50"
        style={{
          animation: "themeSpin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          display: "block",
        }}
      >
        <circle
          cx="25"
          cy="25"
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx="25"
          cy="25"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.72}
          strokeLinecap="round"
        />
      </svg>
      {label && <span className="theme-spinner-label">{label}</span>}
    </div>
  );
}

export function TabLoader({
  title = "Loading Tab…",
  subtitle = "Retrieving verified campaign telemetry and records",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="tab-loader-container">
      <div className="tab-loader-card">
        <div className="tab-loader-spinner-box">
          <Spinner size="lg" />
        </div>
        <div className="tab-loader-text">
          <h4 className="tab-loader-title">{title}</h4>
          <p className="tab-loader-subtitle">{subtitle}</p>
        </div>
        <div className="tab-loader-badge">
          <span className="pulse-dot" />
          <span>Booran South Morang Hyundai · Live Sync</span>
        </div>
      </div>
    </div>
  );
}

export function FullscreenSplash({
  title = "Booran South Morang Hyundai",
  subtitle = "Loyalty Campaign Studio",
  status = "Connecting to verified campaign workspace…",
}: {
  title?: string;
  subtitle?: string;
  status?: string;
}) {
  return (
    <div className="fullscreen-splash-overlay">
      <div className="fullscreen-splash-card">
        <img
          src="/booran-motors-black.png"
          alt="Booran Motors"
          className="fullscreen-splash-logo"
        />
        <div className="fullscreen-splash-header">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="fullscreen-splash-spinner-wrap">
          <Spinner size="lg" />
          <span className="fullscreen-splash-status">{status}</span>
        </div>

        <div className="fullscreen-splash-footer">
          <span>Site 10876 • OmniSuiteAI Confidential</span>
        </div>
      </div>
    </div>
  );
}
