import React, { useState } from "react";
import { useWebSocket, type WsMessage } from "../hooks/useWebSocket.js";
import { useApi } from "../hooks/useApi.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { ProgressBar } from "../components/shared/ProgressBar.js";
import { JsonViewer } from "../components/shared/JsonViewer.js";

const SAMPLE_CONTRACTS = [
  { name: "NDA-Acme-Beta-2026.txt", label: "NDA - Acme Corp" },
  { name: "MSA-GlobalTech-2026.txt", label: "MSA - GlobalTech (High Risk)" },
  { name: "SOW-CloudMigration-2026.txt", label: "SOW - Cloud Migration" },
  { name: "Amendment-DataPolicy-2026.txt", label: "Amendment - Data Policy" },
  { name: "SLA-InfraUptime-2026.txt", label: "SLA - Infrastructure Uptime" },
];

const STAGES = ["intake", "extraction", "compliance", "approval"];
const STAGE_COLORS = [
  "var(--color-intake, var(--color-accent))",
  "var(--color-extraction, #a78bfa)",
  "var(--color-compliance, #f59e0b)",
  "var(--color-approval, var(--color-pass))",
];

export function LiveWorkflow() {
  const { messages, connected, clearMessages } = useWebSocket("ws://localhost:8000/ws/workflow");
  const { loading, post } = useApi<{ contract_id: string }>();
  const [selectedContract, setSelectedContract] = useState(SAMPLE_CONTRACTS[0].name);
  const [hitlResolved, setHitlResolved] = useState<string | null>(null);

  const completedStages = messages
    .filter((m) => m.event === "agent_step_complete")
    .map((m) => m.agent ?? "");

  const progressPercent = (completedStages.length / STAGES.length) * 100;

  // Show HITL panel when compliance flags something
  const hasComplianceFlag = messages.some(
    (m) => m.agent === "compliance" && m.event === "agent_step_complete"
  );
  const showHitl = hasComplianceFlag && !hitlResolved;

  // Extract contract details from messages
  const intakeResult = messages.find(
    (m) => m.agent === "intake" && m.event === "agent_step_complete"
  )?.result as Record<string, unknown> | undefined;

  function resolveHitl(decision: string) {
    setHitlResolved(decision);
  }

  async function handleSubmit() {
    clearMessages();
    setHitlResolved(null);
    try {
      await fetch("/api/v1/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Sample contract: ${selectedContract}`,
          filename: selectedContract,
          source: "dashboard",
        }),
      });
    } catch {
      // Error handled through WS error events
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Live Workflow</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <select
            value={selectedContract}
            onChange={(e) => setSelectedContract(e.target.value)}
            className="select"
            style={{ width: "160px" }}
          >
            {SAMPLE_CONTRACTS.map((c) => (
              <option key={c.name} value={c.name}>{c.label}</option>
            ))}
          </select>
          <StatusBadge status={connected ? "online" : "offline"} />
        </div>
      </div>

      {/* Drop Zone */}
      <div className="workflow-drop-zone">
        <div
          className="drop-area"
          onClick={handleSubmit}
          style={{ cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? "Processing..." : "Drop Contract Here (or click to start demo)"}
        </div>
      </div>

      {/* Pipeline Progress */}
      {messages.length > 0 && (
        <ProgressBar value={progressPercent} label="Pipeline Progress" />
      )}

      {/* 4 Workflow Nodes with Arrows */}
      <div className="workflow-canvas">
        {STAGES.map((stage, i) => {
          const msg = messages.find((m) => m.agent === stage && m.event === "agent_step_complete");
          const isActive = messages.some((m) => m.agent === stage && m.event !== "agent_step_complete") && !msg;
          const isCompleted = !!msg;

          return (
            <React.Fragment key={stage}>
              <div className={`workflow-node${isCompleted ? " completed" : ""}${isActive ? " active" : ""}`}>
                <div className="workflow-node-name" style={{ textTransform: "capitalize" }}>{stage}</div>
                <div className="workflow-node-status">
                  {isCompleted ? "Complete" : isActive ? "Processing..." : "Waiting"}
                </div>
                <div className="workflow-node-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: isCompleted ? "100%" : isActive ? "50%" : "0%",
                        background: STAGE_COLORS[i],
                      }}
                    />
                  </div>
                </div>
                {msg?.latency_ms && (
                  <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)", marginTop: "var(--space-xs)" }}>
                    {msg.latency_ms}ms
                  </div>
                )}
              </div>
              {i < STAGES.length - 1 && <div className="workflow-arrow">{"\u2192"}</div>}
            </React.Fragment>
          );
        })}
      </div>

      {/* Contract Details Bar */}
      {intakeResult && (
        <div className="contract-details-bar">
          <span><strong style={{ color: "var(--color-text-primary)" }}>Type:</strong> {String(intakeResult.type ?? intakeResult.classification ?? "NDA")}</span>
          <span><strong style={{ color: "var(--color-text-primary)" }}>Parties:</strong> {String(intakeResult.parties ?? "Acme Corp / Beta Inc")}</span>
          <span><strong style={{ color: "var(--color-text-primary)" }}>Pages:</strong> {String(intakeResult.pages ?? "12")}</span>
          <span><strong style={{ color: "var(--color-text-primary)" }}>Risk:</strong> {String(intakeResult.risk_level ?? "Medium")}</span>
        </div>
      )}

      {/* Activity Log */}
      <div className="activity-log">
        {messages.length > 0 ? (
          messages.map((msg, i) => (
            <div key={i} className="activity-log-entry">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{msg.event}</span>
                <span style={{ color: "var(--color-text-disabled)" }}>{msg.agent ?? msg.status}</span>
              </div>
              {msg.result != null && <JsonViewer data={msg.result} maxHeight="100px" />}
            </div>
          ))
        ) : (
          <div style={{ color: "var(--color-text-disabled)" }}>Waiting for contract...</div>
        )}
      </div>

      {/* HITL Panel */}
      {showHitl && (
        <div className="hitl-panel">
          <div className="hitl-header">
            <div className="hitl-title">HUMAN REVIEW REQUIRED</div>
            <StatusBadge status="fail" />
          </div>
          <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "12px" }}>
            Reason: Liability cap exceeds $1M policy threshold
          </div>
          <div className="hitl-flagged">
            <div className="hitl-flag">
              <span className="hitl-flag-icon">[!]</span>
              <span>Section 5.2: Liability cap = $2.5M (Policy max: $1M)</span>
            </div>
            <div className="hitl-flag">
              <span className="hitl-flag-icon">[!]</span>
              <span>Section 8.1: No termination for convenience clause</span>
            </div>
          </div>
          <div style={{
            background: "var(--color-bg-card)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-md)",
            fontSize: "13px",
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-md)"
          }}>
            <strong>Extracted Summary:</strong><br />
            Parties: Acme Corp / Beta Inc | Value: $2.5M | Term: 24 months | Auto-renew: Yes
          </div>
          <div className="hitl-actions">
            <button className="btn btn-success" onClick={() => resolveHitl("approved")}>Approve</button>
            <button className="btn btn-danger" onClick={() => resolveHitl("rejected")}>Reject</button>
            <button className="btn btn-warning" onClick={() => resolveHitl("changes")}>Request Changes</button>
            <input className="input" placeholder="Comment (optional)" style={{ maxWidth: "300px" }} />
          </div>
        </div>
      )}

      {hitlResolved && (
        <div style={{
          marginTop: "var(--space-lg)",
          padding: "var(--space-md)",
          background: hitlResolved === "approved" ? "rgba(0,178,148,0.1)" : hitlResolved === "rejected" ? "rgba(231,76,60,0.1)" : "rgba(255,185,0,0.1)",
          border: `1px solid ${hitlResolved === "approved" ? "var(--color-pass)" : hitlResolved === "rejected" ? "var(--color-fail)" : "var(--color-warn)"}`,
          borderRadius: "var(--radius-md)",
          fontSize: "13px",
          color: "var(--color-text-primary)"
        }}>
          Human decision: <strong style={{ textTransform: "capitalize" }}>{hitlResolved}</strong>
        </div>
      )}
    </div>
  );
}
