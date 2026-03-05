import React from "react";

interface Props {
  status: string;
  size?: "sm" | "md";
}

const BADGE_MAP: Record<string, string> = {
  processing: "badge-info",
  awaiting_review: "badge-warn",
  approved: "badge-pass",
  rejected: "badge-fail",
  archived: "badge-info",
  low: "badge-pass",
  medium: "badge-warn",
  high: "badge-fail",
  pass: "badge-pass",
  fail: "badge-fail",
  warn: "badge-warn",
  info: "badge-info",
  online: "badge-pass",
  offline: "badge-fail",
  idle: "badge-info",
};

export function StatusBadge({ status, size = "sm" }: Props) {
  const badgeClass = BADGE_MAP[status] ?? "badge-info";
  const sizeStyle = size === "sm" ? { fontSize: "11px", padding: "2px 8px" } : { fontSize: "13px", padding: "4px 12px" };

  return (
    <span className={`badge ${badgeClass}`} style={sizeStyle}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
