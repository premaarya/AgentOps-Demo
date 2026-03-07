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

interface AgentCost {
  agent: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost: number;
}

interface MonitorData {
  contract_id: string;
  agents: AgentCost[];
  total_tokens: number;
  total_cost: number;
  total_latency_ms: number;
  audit_trail: Array<{
    id: string;
    agent: string;
    action: string;
    reasoning: string;
    timestamp: string;
  }>;
}

interface TraceEntry {
  agent: string;
  tool: string;
  input: unknown;
  output: unknown;
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  timestamp: string;
}

export function MonitorPanel() {
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const contractsApi = useApi<ContractSummary[]>();

  useEffect(() => {
    contractsApi.get("/contracts");
  }, []);

  useEffect(() => {
    if (contractsApi.data && Array.isArray(contractsApi.data)) {
      setContracts(contractsApi.data);
      if (contractsApi.data.length > 0 && !selectedContract) {
        const first = contractsApi.data[0].id;
        setSelectedContract(first);
        loadMonitorData(first);
      }
    }
  }, [contractsApi.data]);

  async function loadMonitorData(contractId: string) {
    setLoadingData(true);
    try {
      const [monRes, traceRes] = await Promise.all([
        fetch(`/api/v1/monitor/${encodeURIComponent(contractId)}`),
        fetch(`/api/v1/traces/${encodeURIComponent(contractId)}`),
      ]);
      if (monRes.ok) {
        const data = await monRes.json() as MonitorData;
        setMonitorData(data);
      }
      if (traceRes.ok) {
        const data = await traceRes.json() as TraceEntry[];
        setTraces(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
    setLoadingData(false);
  }

  function handleContractChange(id: string) {
    setSelectedContract(id);
    loadMonitorData(id);
  }

  // Group traces by agent
  const tracesByAgent = traces.reduce<Record<string, TraceEntry[]>>((acc, t) => {
    (acc[t.agent] ??= []).push(t);
    return acc;
  }, {});

  const agents = monitorData?.agents ?? [];
  const totalLatency = monitorData?.total_latency_ms ?? 0;

  return (
    <div className="animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Monitor Panel</h2>
        <select
          className="select"
          style={{ width: "240px" }}
          value={selectedContract ?? ""}
          onChange={(e) => handleContractChange(e.target.value)}
        >
          {contracts.length === 0 && <option value="">No contracts yet</option>}
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.filename} ({c.status})
            </option>
          ))}
        </select>
      </div>

      {/* Metrics Row */}
      {monitorData && (
        <div className="metric-grid">
          <MetricCard label="Total Tokens" value={monitorData.total_tokens.toLocaleString()} />
          <MetricCard label="Total Cost" value={`$${monitorData.total_cost.toFixed(4)}`} />
          <MetricCard label="Latency" value={`${(monitorData.total_latency_ms / 1000).toFixed(1)}s`} />
          <MetricCard label="Agents" value={agents.length} />
        </div>
      )}

      {!monitorData && !loadingData && (
        <div style={{ textAlign: "center", color: "var(--color-text-disabled)", padding: "var(--space-xl)" }}>
          {contracts.length === 0
            ? "No contracts processed yet. Submit a contract in Live Workflow to see data here."
            : "Select a contract to view monitoring data."}
        </div>
      )}

      {loadingData && (
        <div style={{ textAlign: "center", color: "var(--color-text-tertiary)", padding: "var(--space-xl)" }}>
          Loading monitoring data...
        </div>
      )}

      {monitorData && (
        <>
          {/* Trace Tree */}
          <div style={{ background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
            <div className="card-header">Trace Tree</div>
            {Object.keys(tracesByAgent).length === 0 ? (
              <div style={{ color: "var(--color-text-disabled)", fontSize: "13px" }}>No trace data available for this contract.</div>
            ) : (
              Object.entries(tracesByAgent).map(([agent, agentTraces]) => (
                <div key={agent} style={{ marginBottom: "var(--space-md)" }}>
                  <div style={{ fontWeight: 600, textTransform: "capitalize", color: "var(--color-text-primary)", marginBottom: "var(--space-xs)" }}>
                    {agent} <span style={{ fontSize: "11px", color: "var(--color-text-disabled)" }}>({agentTraces.length} calls)</span>
                  </div>
                  {agentTraces.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", marginLeft: "var(--space-md)", marginBottom: "2px" }}>
                      <span style={{ color: "var(--color-text-disabled)" }}>├─</span>
                      <span>{t.tool}</span>
                      <span style={{ color: "var(--color-text-disabled)" }}>{t.latency_ms}ms</span>
                      <span style={{ color: "var(--color-text-disabled)" }}>({t.tokens_in}→{t.tokens_out} tok)</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Latency Breakdown */}
          <div style={{ background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
            <div className="card-header">Latency Breakdown</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {agents.map((a) => {
                const pct = totalLatency > 0 ? (a.latency_ms / totalLatency) * 100 : 0;
                const cls = a.latency_ms < 1000 ? "var(--color-pass)" : a.latency_ms < 3000 ? "var(--color-warn)" : "var(--color-fail)";
                return (
                  <div key={a.agent}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "2px" }}>
                      <span style={{ textTransform: "capitalize", color: "var(--color-text-primary)" }}>{a.agent}</span>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>{(a.latency_ms / 1000).toFixed(1)}s ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "var(--color-bg-elevated)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: cls, borderRadius: "3px", transition: "width 0.3s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Token Usage */}
          <div style={{ background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
            <div className="card-header">Token Usage</div>
            <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--color-text-disabled)", borderBottom: "1px solid var(--color-border)" }}>
                  <th style={{ textAlign: "left", padding: "6px 0" }}>Agent</th>
                  <th style={{ textAlign: "right", padding: "6px 0" }}>In</th>
                  <th style={{ textAlign: "right", padding: "6px 0" }}>Out</th>
                  <th style={{ textAlign: "right", padding: "6px 0" }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.agent} style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-bg-elevated)" }}>
                    <td style={{ padding: "6px 0", textTransform: "capitalize" }}>{a.agent}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{a.tokens_in.toLocaleString()}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{a.tokens_out.toLocaleString()}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>${a.cost.toFixed(4)}</td>
                  </tr>
                ))}
                <tr style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
                  <td style={{ padding: "6px 0" }}>Total</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{monitorData.total_tokens.toLocaleString()}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>—</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>${monitorData.total_cost.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Audit Trail */}
          {monitorData.audit_trail && monitorData.audit_trail.length > 0 && (
            <div style={{ background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
              <div className="card-header">Decision Audit Trail</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {monitorData.audit_trail.map((entry, i) => (
                  <div key={entry.id || i} style={{ display: "flex", gap: "var(--space-md)", fontSize: "12px", padding: "var(--space-sm) 0", borderBottom: i < monitorData.audit_trail.length - 1 ? "1px solid var(--color-bg-elevated)" : "none" }}>
                    <span style={{ color: "var(--color-text-disabled)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span style={{ color: "var(--color-text-primary)", fontWeight: 500, textTransform: "capitalize", flexShrink: 0, width: "80px" }}>
                      {entry.agent}
                    </span>
                    <span style={{ color: "var(--color-text-secondary)" }}>
                      {entry.action}: {entry.reasoning}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
