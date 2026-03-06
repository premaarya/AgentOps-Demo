import React from "react";

interface Props {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
}

const BORDER_COLORS: Record<string, string> = {
  up: "var(--color-pass)",
  down: "var(--color-fail)",
  neutral: "var(--color-accent)",
};

export function MetricCard({ label, value, subtitle, trend }: Props) {
  const borderColor = trend ? (BORDER_COLORS[trend] ?? "var(--color-accent)") : "var(--color-accent)";
  const trendTextColor = trend === "up" ? "var(--color-pass)" : trend === "down" ? "var(--color-fail)" : "var(--color-text-tertiary)";

  return (
    <div className="metric-card" style={{ borderLeftColor: borderColor }}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {subtitle && (
        <div className="metric-threshold" style={{ color: trendTextColor }}>{subtitle}</div>
      )}
    </div>
  );
}
