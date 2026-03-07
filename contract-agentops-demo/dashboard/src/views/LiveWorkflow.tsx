import React, { useState, useEffect, useRef } from "react";
import { useWebSocket, type WsMessage } from "../hooks/useWebSocket.js";
import { useApi } from "../hooks/useApi.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { ProgressBar } from "../components/shared/ProgressBar.js";
import { JsonViewer } from "../components/shared/JsonViewer.js";

interface SampleContract { filename: string }

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
  const [sampleContracts, setSampleContracts] = useState<SampleContract[]>([]);
  const [selectedContract, setSelectedContract] = useState("");
  const [contractText, setContractText] = useState("");
  const [inputMode, setInputMode] = useState<"sample" | "paste" | "file">("sample");
  const [hitlResolved, setHitlResolved] = useState<string | null>(null);
  const [hitlComment, setHitlComment] = useState("");
  const [contractId, setContractId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/v1/sample-contracts")
      .then((r) => r.json())
      .then((data: SampleContract[]) => {
        setSampleContracts(data);
        if (data.length > 0) {
          setSelectedContract(data[0].filename);
          loadSampleText(data[0].filename);
        }
      })
      .catch(() => {});
  }, []);

  async function loadSampleText(filename: string) {
    try {
      const res = await fetch(`/api/v1/sample-contracts/${encodeURIComponent(filename)}`);
      const data = await res.json() as { text: string };
      setContractText(data.text);
    } catch { /* ignore */ }
  }

  const completedStages = messages
    .filter((m) => m.event === "agent_step_complete")
    .map((m) => m.agent ?? "");

  const progressPercent = (completedStages.length / STAGES.length) * 100;

  // Extract results from agent messages
  const intakeResult = messages.find(
    (m) => m.agent === "intake" && m.event === "agent_step_complete"
  )?.result as Record<string, unknown> | undefined;

  const extractionResult = messages.find(
    (m) => m.agent === "extraction" && m.event === "agent_step_complete"
  )?.result as Record<string, unknown> | undefined;

  const complianceResult = messages.find(
    (m) => m.agent === "compliance" && m.event === "agent_step_complete"
  )?.result as Record<string, unknown> | undefined;

  const approvalResult = messages.find(
    (m) => m.agent === "approval" && m.event === "agent_step_complete"
  )?.result as Record<string, unknown> | undefined;

  // Show HITL when approval escalates to human
  const showHitl = (approvalResult?.action === "escalate_to_human" ||
    messages.some((m) => m.event === "hitl_required")) && !hitlResolved;

  // Get real compliance flags from results
  const complianceFlags = (() => {
    if (!complianceResult) return [];
    const results = (complianceResult.clauseResults ?? complianceResult.clause_results ?? []) as Array<{
      clause?: string; type?: string; status?: string; reason?: string;
    }>;
    return results.filter((r) => r.status === "fail" || r.status === "warn");
  })();

  async function resolveHitl(decision: string) {
    setHitlResolved(decision);
    if (contractId) {
      try {
        await fetch(`/api/v1/contracts/${contractId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: decision === "approved" ? "approve" : decision === "rejected" ? "reject" : "request_changes",
            reviewer: "dashboard-user",
            comment: hitlComment,
          }),
        });
      } catch { /* non-critical */ }
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setContractText(reader.result as string);
    reader.readAsText(file);
  }

  async function handleSubmit() {
    if (!contractText.trim()) return;
    clearMessages();
    setHitlResolved(null);
    setContractId(null);
    try {
      const res = await fetch("/api/v1/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: contractText,
          filename: selectedContract || "uploaded-contract.txt",
          source: "dashboard",
        }),
      });
      const data = await res.json() as { contract_id: string };
      setContractId(data.contract_id);
    } catch {
      // Error handled through WS error events
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Live Workflow</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {(["sample", "paste", "file"] as const).map((mode) => (
              <button key={mode} className={`btn btn-ghost${inputMode === mode ? " active" : ""}`}
                style={{ fontSize: "11px", padding: "4px 8px", textTransform: "capitalize",
                  background: inputMode === mode ? "var(--color-accent)" : undefined,
                  color: inputMode === mode ? "#fff" : undefined }}
                onClick={() => setInputMode(mode)}>{mode}</button>
            ))}
          </div>
          <StatusBadge status={connected ? "online" : "offline"} />
        </div>
      </div>

      {/* Contract Input */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        {inputMode === "sample" && (
          <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center" }}>
            <select value={selectedContract}
              onChange={(e) => { setSelectedContract(e.target.value); loadSampleText(e.target.value); }}
              className="select" style={{ flex: 1 }}>
              {sampleContracts.map((c) => (
                <option key={c.filename} value={c.filename}>{c.filename}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !contractText.trim()}>
              {loading ? "Processing..." : "Run Pipeline"}
            </button>
          </div>
        )}
        {inputMode === "paste" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <textarea className="textarea" rows={6} placeholder="Paste contract text here..."
              value={contractText} onChange={(e) => setContractText(e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }} />
            <button className="btn btn-primary" onClick={handleSubmit}
              disabled={loading || !contractText.trim()}>
              {loading ? "Processing..." : "Run Pipeline"}
            </button>
          </div>
        )}
        {inputMode === "file" && (
          <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center" }}>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf"
              onChange={handleFileUpload} className="input" style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={handleSubmit}
              disabled={loading || !contractText.trim()}>
              {loading ? "Processing..." : "Run Pipeline"}
            </button>
          </div>
        )}
        {contractText && (
          <div style={{ marginTop: "var(--space-sm)", fontSize: "11px", color: "var(--color-text-disabled)" }}>
            {contractText.length.toLocaleString()} characters loaded
          </div>
        )}
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
                    <div className="progress-fill"
                      style={{ width: isCompleted ? "100%" : isActive ? "50%" : "0%", background: STAGE_COLORS[i] }} />
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
          <span><strong style={{ color: "var(--color-text-primary)" }}>Type:</strong> {String(intakeResult.type ?? intakeResult.classification ?? "—")}</span>
          <span><strong style={{ color: "var(--color-text-primary)" }}>Parties:</strong> {Array.isArray(intakeResult.parties) ? (intakeResult.parties as string[]).join(", ") : String(intakeResult.parties ?? "—")}</span>
          <span><strong style={{ color: "var(--color-text-primary)" }}>Confidence:</strong> {String(intakeResult.confidence ?? intakeResult.classification_confidence ?? "—")}</span>
          <span><strong style={{ color: "var(--color-text-primary)" }}>Risk:</strong> {String(intakeResult.risk_level ?? intakeResult.risk ?? "—")}</span>
        </div>
      )}

      {/* Extraction Summary */}
      {extractionResult && (
        <div style={{ background: "var(--color-bg-card)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", marginTop: "var(--space-md)", fontSize: "13px" }}>
          <strong style={{ color: "var(--color-text-primary)" }}>Extraction:</strong>{" "}
          <span style={{ color: "var(--color-text-secondary)" }}>
            {Array.isArray(extractionResult.clauses) ? `${(extractionResult.clauses as unknown[]).length} clauses` : ""}
            {extractionResult.parties ? ` | Parties: ${Array.isArray(extractionResult.parties) ? (extractionResult.parties as string[]).join(", ") : extractionResult.parties}` : ""}
            {extractionResult.values ? ` | Values: ${JSON.stringify(extractionResult.values)}` : ""}
          </span>
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
            Reason: {String(approvalResult?.reason ?? "Compliance flagged issues requiring review")}
          </div>
          {complianceFlags.length > 0 && (
            <div className="hitl-flagged">
              {complianceFlags.map((flag, i) => (
                <div key={i} className="hitl-flag">
                  <span className="hitl-flag-icon">[!]</span>
                  <span>{flag.clause ?? flag.type ?? "Flag"}: {flag.reason ?? "Review needed"}</span>
                </div>
              ))}
            </div>
          )}
          <div className="hitl-actions">
            <button className="btn btn-success" onClick={() => resolveHitl("approved")}>Approve</button>
            <button className="btn btn-danger" onClick={() => resolveHitl("rejected")}>Reject</button>
            <button className="btn btn-warning" onClick={() => resolveHitl("changes")}>Request Changes</button>
            <input className="input" placeholder="Comment (optional)" style={{ maxWidth: "300px" }}
              value={hitlComment} onChange={(e) => setHitlComment(e.target.value)} />
          </div>
        </div>
      )}

      {hitlResolved && (
        <div style={{
          marginTop: "var(--space-lg)", padding: "var(--space-md)",
          background: hitlResolved === "approved" ? "rgba(0,178,148,0.1)" : hitlResolved === "rejected" ? "rgba(231,76,60,0.1)" : "rgba(255,185,0,0.1)",
          border: `1px solid ${hitlResolved === "approved" ? "var(--color-pass)" : hitlResolved === "rejected" ? "var(--color-fail)" : "var(--color-warn)"}`,
          borderRadius: "var(--radius-md)", fontSize: "13px", color: "var(--color-text-primary)"
        }}>
          Human decision: <strong style={{ textTransform: "capitalize" }}>{hitlResolved}</strong>
        </div>
      )}
    </div>
  );
}
