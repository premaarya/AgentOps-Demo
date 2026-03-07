import React from "react";

interface Props {
  name: string;
  role: string;
  model?: string;
  boundary?: string;
  status?: "idle" | "running" | "complete" | "error";
  tools: string[];
  latency?: number;
}

const AGENT_COLORS: Record<string, string> = {
  intake: "var(--color-intake)",
  extraction: "var(--color-extraction)",
  compliance: "var(--color-compliance)",
  approval: "var(--color-approval)",
};

function getAgentKey(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("intake")) return "intake";
  if (lower.includes("extraction")) return "extraction";
  if (lower.includes("compliance")) return "compliance";
  if (lower.includes("approval")) return "approval";
  return "intake";
}

export function AgentCard({ name, role, model, boundary, status = "idle", tools, latency }: Props) {
  const agentKey = getAgentKey(name);
  const accentColor = AGENT_COLORS[agentKey] ?? "var(--color-accent)";

  const statusBadge: Record<string, { bg: string; text: string }> = {
    idle: { bg: "rgba(160,160,160,0.15)", text: "var(--color-text-tertiary)" },
    running: { bg: "rgba(80,230,255,0.15)", text: "var(--color-accent)" },
    complete: { bg: "rgba(0,178,148,0.15)", text: "var(--color-pass)" },
    error: { bg: "rgba(231,76,60,0.15)", text: "var(--color-fail)" },
  };

  const badge = statusBadge[status] ?? statusBadge.idle;

  return (
    <div className="agent-card" data-agent={agentKey}>
      <div className="agent-card-icon" style={{ background: accentColor }}>
        {name.charAt(0)}
      </div>
      <div className="agent-card-name">{name}</div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: badge.bg, color: badge.text }}
        >
          {status}
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--color-text-tertiary)" }}>{role}</p>
      {model && (
        <div className="text-xs mb-2" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>
          Model: {model}
        </div>
      )}
      <div className="agent-card-section">
        <div className="agent-card-section-title">Tools</div>
        {tools.map((tool) => (
          <div key={tool} className="agent-card-tool">{tool}</div>
        ))}
      </div>
      {boundary && (
        <div className="agent-card-section" style={{ marginTop: "var(--space-sm)" }}>
          <div className="agent-card-section-title">Boundary</div>
          <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>{boundary}</div>
        </div>
      )}
      {latency !== undefined && (
        <p className="text-xs mt-2" style={{ color: "var(--color-text-disabled)", fontFamily: "var(--font-mono)" }}>{latency}ms</p>
      )}
    </div>
  );
}
