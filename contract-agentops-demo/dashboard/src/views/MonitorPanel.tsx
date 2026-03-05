import React, { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi.js";
import { MetricCard } from "../components/shared/MetricCard.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";

interface ContractSummary {
  id: string;
  filename: string;
  type?: string;
  status: string;
  submitted_at: string;
}

interface AuditEntry {
  id: string;
  agent: string;
  action: string;
  reasoning: string;
  timestamp: string;
}

/* Static trace data matching the prototype */
const TRACE_DATA = [
  {
    agent: "Intake",
    color: "var(--color-intake)",
    time: "1.2s",
    tools: [
      { name: "classify_doc", time: "0.4s", status: "pass" },
      { name: "extract_meta", time: "0.8s", status: "pass" },
    ],
  },
  {
    agent: "Extraction",
    color: "var(--color-extraction)",
    time: "2.8s",
    tools: [
      { name: "extract_clauses", time: "1.9s", status: "pass" },
      { name: "identify_parties", time: "0.5s", status: "pass" },
      { name: "extract_dates", time: "0.4s", status: "pass" },
    ],
  },
  {
    agent: "Compliance",
    color: "var(--color-compliance)",
    time: "1.5s",
    tools: [
      { name: "check_policy", time: "0.8s", status: "warn" },
      { name: "flag_risk", time: "0.7s", status: "warn" },
    ],
  },
  {
    agent: "Approval",
    color: "var(--color-approval)",
    time: "0.3s",
    tools: [
      { name: "route_approval", time: "0.2s", status: "pass" },
      { name: "escalate_to_human", time: "0.1s", status: "pass" },
    ],
  },
];

const LATENCY_DATA = [
  { agent: "Intake", time: "1.2s", width: "21%", speed: "fast" as const },
  { agent: "Extraction", time: "2.8s", width: "48%", speed: "medium" as const },
  { agent: "Compliance", time: "1.5s", width: "26%", speed: "fast" as const },
  { agent: "Approval", time: "0.3s", width: "5%", speed: "fast" as const },
];

const TOKEN_DATA = [
  { agent: "Intake", input: "1,204", output: "342", cost: "$0.01" },
  { agent: "Extraction", input: "3,891", output: "1,205", cost: "$0.03" },
  { agent: "Compliance", input: "2,156", output: "678", cost: "$0.02" },
  { agent: "Approval", input: "456", output: "123", cost: "$0.00" },
  { agent: "Total", input: "7,707", output: "2,348", cost: "$0.06" },
];

const DECISION_TRAIL = [
  { time: "10:04:01", agent: "Intake", decision: "Classified as NDA", reasoning: "97% conf, keyword match" },
  { time: "10:04:04", agent: "Extraction", decision: "Extracted 6 clauses", reasoning: "Structured output, sections 1-8" },
  { time: "10:04:06", agent: "Compliance", decision: "Flagged Section 5.2", reasoning: "Liability $2.5M > policy max $1M" },
  { time: "10:04:06", agent: "Compliance", decision: "Flagged Section 8.1", reasoning: "Missing termination for convenience" },
  { time: "10:04:07", agent: "Approval", decision: "Escalated to human", reasoning: "Risk level: HIGH (2 compliance flags)" },
  { time: "10:04:52", agent: "Human", decision: "Approved with comment", reasoning: '"Acceptable for strategic partner"' },
];

export function MonitorPanel() {
  const contractsApi = useApi<ContractSummary[]>();
  const auditApi = useApi<AuditEntry[]>();
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    contractsApi.get("/contracts");
  }, []);

  useEffect(() => {
    if (selectedContract) {
      auditApi.get(`/audit/${selectedContract}`);
    }
  }, [selectedContract]);

  const contracts = contractsApi.data ?? [];
  const auditEntries = auditApi.data ?? [];

  const approved = contracts.filter((c) => c.status === "approved").length;
  const awaiting = contracts.filter((c) => c.status === "awaiting_review").length;
  const processing = contracts.filter((c) => c.status === "processing").length;

  function toggleTrace(agent: string) {
    setCollapsed((prev) => ({ ...prev, [agent]: !prev[agent] }));
  }

  return (
    <div className="animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Monitor Panel</h2>
        <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "var(--color-text-tertiary)" }}>Contract:</span>
          <select
            className="select"
            value={selectedContract ?? ""}
            onChange={(e) => setSelectedContract(e.target.value || null)}
          >
            <option value="">Select contract</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.filename}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="metric-grid" style={{ marginBottom: "var(--space-lg)" }}>
        <MetricCard label="Total Contracts" value={contracts.length} />
        <MetricCard label="Approved" value={approved} subtitle={`${contracts.length > 0 ? Math.round((approved / contracts.length) * 100) : 0}%`} trend="up" />
        <MetricCard label="Awaiting Review" value={awaiting} trend={awaiting > 0 ? "down" : "neutral"} />
        <MetricCard label="Processing" value={processing} />
      </div>

      <div className="monitor-layout">
        {/* Left: Trace Tree */}
        <div className="card" style={{ background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)" }}>
          <div className="card-header">Trace Tree</div>
          <div className="trace-tree">
            {TRACE_DATA.map((trace) => (
              <div key={trace.agent} className="trace-agent">
                <div className="trace-agent-header" onClick={() => toggleTrace(trace.agent)}>
                  <span style={{ color: "var(--color-text-disabled)", cursor: "pointer" }}>{collapsed[trace.agent] ? "[+]" : "[-]"}</span>
                  <span className="trace-agent-name" style={{ color: trace.color }}>{trace.agent}</span>
                  <span className="trace-agent-time">{trace.time}</span>
                </div>
                {!collapsed[trace.agent] && (
                  <div className="trace-tools">
                    {trace.tools.map((tool) => (
                      <div key={tool.name} className="trace-tool">
                        <span className="trace-tool-time">{tool.time}</span>
                        {tool.name}
                        <StatusBadge status={tool.status as "pass" | "warn"} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Latency + Token + Decision */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {/* Latency Breakdown */}
          <div className="card" style={{ background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)" }}>
            <div className="card-header">Latency Breakdown</div>
            {LATENCY_DATA.map((item) => (
              <div key={item.agent} className="latency-bar">
                <div className="latency-label">{item.agent}</div>
                <div className="latency-fill-wrapper">
                  <div className={`latency-fill ${item.speed}`} style={{ width: item.width }} />
                </div>
                <div className="latency-time">{item.time}</div>
              </div>
            ))}
            <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--color-text-tertiary)" }}>
              Total: 5.8s (agent) + 45s (human)
            </div>
          </div>

          {/* Token Usage */}
          <div className="card" style={{ background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)" }}>
            <div className="card-header">Token Usage</div>
            <table className="data-table">
              <thead>
                <tr><th>Agent</th><th>In</th><th>Out</th><th>Cost</th></tr>
              </thead>
              <tbody>
                {TOKEN_DATA.map((row) => (
                  <tr key={row.agent} style={row.agent === "Total" ? { fontWeight: 600 } : undefined}>
                    <td>{row.agent}</td>
                    <td>{row.input}</td>
                    <td>{row.output}</td>
                    <td>{row.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Decision Audit Trail */}
          <div className="card" style={{ background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)" }}>
            <div className="card-header">Decision Audit Trail</div>
            <table className="data-table">
              <thead>
                <tr><th>Time</th><th>Agent</th><th>Decision</th><th>Reasoning</th></tr>
              </thead>
              <tbody>
                {DECISION_TRAIL.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{row.time}</td>
                    <td>{row.agent}</td>
                    <td>{row.decision}</td>
                    <td style={{ color: "var(--color-text-tertiary)" }}>{row.reasoning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Per-contract audit trail (from live API) */}
      {selectedContract && auditEntries.length > 0 && (
        <div className="card" style={{ background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
          <div className="card-header">
            Live Audit Trail <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-text-tertiary)" }}>- {selectedContract}</span>
          </div>
          <div className="trace-tree">
            {auditEntries.map((entry) => (
              <div key={entry.id} className="trace-agent">
                <div className="trace-agent-header">
                  <span className="trace-agent-name" style={{ textTransform: "capitalize" }}>{entry.agent}</span>
                  <StatusBadge status={entry.action === "approved" ? "approved" : entry.action === "escalated" ? "awaiting_review" : "processing"} />
                  <span className="trace-agent-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="trace-tools">
                  <div className="trace-tool">{entry.reasoning}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
