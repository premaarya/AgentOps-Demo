import React, { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi.js";
import { MetricCard } from "../components/shared/MetricCard.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { JsonViewer } from "../components/shared/JsonViewer.js";

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

export function MonitorPanel() {
  const contractsApi = useApi<ContractSummary[]>();
  const auditApi = useApi<AuditEntry[]>();
  const [selectedContract, setSelectedContract] = useState<string | null>(null);

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

  return (
    <div className="animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Monitor Panel</h2>
      </div>

      <div className="metric-grid" style={{ marginBottom: "var(--space-lg)" }}>
        <MetricCard label="Total Contracts" value={contracts.length} />
        <MetricCard label="Approved" value={approved} subtitle={`${contracts.length > 0 ? Math.round((approved / contracts.length) * 100) : 0}%`} trend="up" />
        <MetricCard label="Awaiting Review" value={awaiting} trend={awaiting > 0 ? "down" : "neutral"} />
        <MetricCard label="Processing" value={processing} />
      </div>

      <div className="monitor-layout">
        {/* Contract List */}
        <div>
          <div className="card-header">Contracts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", maxHeight: "400px", overflowY: "auto" }}>
            {contracts.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-text-disabled)" }}>No contracts processed yet</p>
            ) : (
              contracts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedContract(c.id)}
                  className="card"
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    width: "100%",
                    border: selectedContract === c.id ? "2px solid var(--color-accent)" : "2px solid transparent",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>{c.filename}</p>
                      <p style={{ fontSize: "11px", color: "var(--color-text-disabled)", fontFamily: "var(--font-mono)" }}>{c.id}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                      {c.type && <span style={{ fontSize: "12px", color: "var(--color-text-tertiary)" }}>{c.type}</span>}
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Audit Trail */}
        <div>
          <div className="card-header">
            Audit Trail {selectedContract && <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-text-tertiary)" }}>- {selectedContract}</span>}
          </div>
          {selectedContract ? (
            auditEntries.length > 0 ? (
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
            ) : (
              <p className="text-sm" style={{ color: "var(--color-text-disabled)" }}>No audit entries for this contract</p>
            )
          ) : (
            <div className="code-block" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "150px" }}>
              Select a contract to view its audit trail
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
