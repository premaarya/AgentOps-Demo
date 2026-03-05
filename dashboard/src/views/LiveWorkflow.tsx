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

export function LiveWorkflow() {
  const { messages, connected, clearMessages } = useWebSocket("ws://localhost:8000/ws/workflow");
  const { loading, post } = useApi<{ contract_id: string }>();
  const [selectedContract, setSelectedContract] = useState(SAMPLE_CONTRACTS[0].name);

  const completedStages = messages
    .filter((m) => m.event === "agent_step_complete")
    .map((m) => m.agent ?? "");

  const progressPercent = (completedStages.length / STAGES.length) * 100;

  async function handleSubmit() {
    clearMessages();
    // Fetch the sample contract text
    try {
      const res = await fetch(`/api/v1/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Sample contract: ${selectedContract}`,
          filename: selectedContract,
          source: "dashboard",
        }),
      });
      // Pipeline runs asynchronously; updates come via WebSocket
    } catch {
      // Error handled through WS error events
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="view-header">
        <div>
          <h2 className="view-title">Live Workflow</h2>
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Submit a contract and watch the 4-agent pipeline process it in real-time
          </p>
        </div>
        <StatusBadge status={connected ? "online" : "offline"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "var(--space-lg)" }}>
        {/* Left: Submit */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div className="card-header">Submit Contract</div>
          <div>
            <div className="console-panel-label">Sample Contract</div>
            <select
              value={selectedContract}
              onChange={(e) => setSelectedContract(e.target.value)}
              className="select"
              style={{ width: "100%" }}
            >
              {SAMPLE_CONTRACTS.map((c) => (
                <option key={c.name} value={c.name}>{c.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn btn-primary"
            style={{ width: "100%" }}
          >
            {loading ? "Submitting..." : "Submit Contract"}
          </button>
        </div>

        {/* Center: Pipeline Progress */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <ProgressBar value={progressPercent} label="Pipeline Progress" />
          <div className="workflow-canvas">
            {STAGES.map((stage, i) => {
              const msg = messages.find((m) => m.agent === stage && m.event === "agent_step_complete");
              const isCompleted = !!msg;
              return (
                <React.Fragment key={stage}>
                  <div className={`workflow-node${isCompleted ? " completed" : ""}`}>
                    <div className="workflow-node-name" style={{ textTransform: "capitalize" }}>{stage}</div>
                    <div className="workflow-node-status">
                      {msg?.latency_ms && <span style={{ fontFamily: "var(--font-mono)" }}>{msg.latency_ms}ms</span>}
                    </div>
                    <StatusBadge status={msg ? "pass" : "idle"} />
                  </div>
                  {i < STAGES.length - 1 && <div className="workflow-arrow">-&gt;</div>}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Right: Events Log */}
        <div>
          <div className="card-header">Event Log</div>
          {messages.length > 0 ? (
            <div className="activity-log">
              {messages.map((msg, i) => (
                <div key={i} className="activity-log-entry">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{msg.event}</span>
                    <span style={{ color: "var(--color-text-disabled)" }}>{msg.agent ?? msg.status}</span>
                  </div>
                  {msg.result != null && <JsonViewer data={msg.result} maxHeight="100px" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="code-block" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "150px" }}>
              Submit a contract to see real-time updates
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
