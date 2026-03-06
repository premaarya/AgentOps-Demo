import React from "react";

interface Props {
  value: number; // 0-100
  label?: string;
  color?: string;
}

export function ProgressBar({ value, label, color }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const barColor = color ?? "var(--color-accent)";

  return (
    <div>
      {label && <p className="metric-label" style={{ marginBottom: "var(--space-xs)" }}>{label}</p>}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${clamped}%`, background: barColor }}
        />
      </div>
    </div>
  );
}
