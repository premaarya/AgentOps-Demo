import React, { useState, useEffect } from "react";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/shared/StatusBadge";

interface StageResult {
  name: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  duration_ms: number;
  details?: Record<string, unknown>;
  error?: string;
}

interface FoundryAgentInfo {
  agent_name: string;
  foundry_agent_id: string;
  model: string;
  status: "registered" | "failed";
  tools_count: number;
}

interface SecurityCheck {
  check: string;
  status: string;
  detail?: string;
}

interface DeployResult {
  pipeline_id: string;
  mode: "live" | "simulated";
  stages: StageResult[];
  agents: FoundryAgentInfo[];
  security: {
    identity_access: SecurityCheck[];
    content_safety: SecurityCheck[];
  };
  evaluation?: {
    test_count: number;
    passed: number;
    accuracy: number;
  };
  summary: {
    agents_deployed: number;
    tools_registered: number;
    errors: number;
    total_duration_ms: number;
  };
}

interface ModeInfo {
  mode: "live" | "simulated";
  foundry_configured: boolean;
}

export function DeployDashboard() {
  const { post, loading } = useApi<DeployResult>();
  const modeApi = useApi<ModeInfo>();
  const cleanupApi = useApi<{ deleted: number; errors: string[]; message: string }>();
  const [result, setResult] = useState<DeployResult | null>(null);
  const [animStage, setAnimStage] = useState(-1);
  const [modeInfo, setModeInfo] = useState<ModeInfo | null>(null);

  useEffect(() => {
    modeApi.get("/deploy/mode").then((data) => {
      if (data) setModeInfo(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageNames = [
    "Preflight",
    "Model Deployment",
    "Agent Registration",
    "Content Safety",
    "Evaluation",
    "Health Check",
  ];

  async function runDeploy() {
    setAnimStage(0);
    setResult(null);

    const data = await post("/deploy/pipeline", {});
    if (!data) return;

    // Animate stages sequentially
    for (let i = 0; i < data.stages.length; i++) {
      setAnimStage(i);
      await new Promise((r) => setTimeout(r, 600));
    }
    setAnimStage(data.stages.length);
    setResult(data);
  }

  async function handleCleanup() {
    const data = await cleanupApi.post("/deploy/agents", {});
    if (data) {
      setResult(null);
      setAnimStage(-1);
    }
  }

  function stageStatusColor(status: string): string {
    switch (status) {
      case "passed": return "border-green-500 bg-green-50";
      case "failed": return "border-red-500 bg-red-50";
      case "skipped": return "border-yellow-500 bg-yellow-50";
      default: return "border-gray-200 bg-gray-50";
    }
  }

  function stageLabel(status: string): string {
    switch (status) {
      case "passed": return "[PASS]";
      case "failed": return "[FAIL]";
      case "skipped": return "[SKIP]";
      default: return "Pending";
    }
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      <div className="view-header">
        <div>
          <h2 className="view-title">Deploy to Azure AI Foundry</h2>
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            {modeInfo?.mode === "live"
              ? "Live deployment to Azure AI Foundry"
              : "Simulated deployment pipeline (set DEMO_MODE=live for real deployment)"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <span className={`badge ${modeInfo?.mode === "live" ? "badge-pass" : "badge-warn"}`}>
            {modeInfo?.mode === "live" ? "LIVE" : "SIMULATED"}
          </span>
          {result && result.agents.some((a) => a.status === "registered") && (
            <button onClick={handleCleanup} disabled={cleanupApi.loading} className="btn btn-danger">
              {cleanupApi.loading ? "Cleaning..." : "Cleanup Agents"}
            </button>
          )}
          <button onClick={runDeploy} disabled={loading} className="btn btn-primary">
            {loading ? "Deploying..." : "Deploy Pipeline ->"}
          </button>
        </div>
      </div>

      {/* Pipeline stages - 6-stage real pipeline */}
      <div className="card">
        <div className="card-header">Deployment Pipeline</div>
        <div className="deploy-pipeline">
          {stageNames.map((name, i) => {
            const stage = result?.stages[i];
            const isActive = animStage === i;
            const isDone = animStage > i;

            let stageClass = "deploy-stage";
            if (isDone && stage) {
              stageClass += stage.status === "passed" ? " passed" : stage.status === "failed" ? " failed" : "";
            } else if (isActive) {
              stageClass += " active";
            }

            return (
              <React.Fragment key={name}>
                <div className={stageClass}>
                  <div className="deploy-stage-name">{name}</div>
                  <div className="deploy-stage-status">
                    {isDone && stage ? (
                      <span className={`badge ${stage.status === "passed" ? "badge-pass" : stage.status === "failed" ? "badge-fail" : "badge-warn"}`}>
                        {stageLabel(stage.status)}
                      </span>
                    ) : isActive ? (
                      <span className="badge badge-info animate-pulse-custom">Running...</span>
                    ) : (
                      <span className="badge badge-info">Pending</span>
                    )}
                  </div>
                  {isDone && stage && (
                    <div className="deploy-stage-time">
                      {stage.duration_ms < 1000
                        ? `${stage.duration_ms}ms`
                        : `${(stage.duration_ms / 1000).toFixed(1)}s`}
                    </div>
                  )}
                </div>
                {i < stageNames.length - 1 && <span className="deploy-arrow">-&gt;</span>}
              </React.Fragment>
            );
          })}
        </div>
        {/* Show stage errors */}
        {result?.stages.some((s) => s.error) && (
          <div style={{ marginTop: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            {result.stages
              .filter((s) => s.error)
              .map((s) => (
                <div key={s.name} className="badge-fail" style={{ padding: "var(--space-sm) var(--space-md)", borderRadius: "var(--radius-sm)", fontSize: "12px" }}>
                  {s.name}: {s.error}
                </div>
              ))}
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Agent Registration */}
          <div className="card">
            <div className="card-header">
              Foundry Agent Registration
              {result.mode === "live" && (
                <span className="badge badge-pass" style={{ marginLeft: "var(--space-sm)" }}>Azure AI Foundry</span>
              )}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Foundry ID</th>
                  <th>Model</th>
                  <th>Tools</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {result.agents.map((agent) => (
                  <tr key={agent.agent_name}>
                    <td style={{ fontWeight: 600 }}>{agent.agent_name}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                      {agent.foundry_agent_id || "-"}
                    </td>
                    <td style={{ fontSize: "12px" }}>{agent.model}</td>
                    <td style={{ fontSize: "12px" }}>{agent.tools_count}</td>
                    <td>
                      <StatusBadge
                        status={agent.status === "registered" ? "pass" : "fail"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Security + Evaluation */}
          <div className="security-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="security-card">
              <div className="security-card-title">Identity & Access</div>
              {result.security.identity_access.map((c) => (
                <div key={c.check} className="security-item">
                  <StatusBadge status={c.status === "passed" ? "pass" : "fail"} />
                  <span>{c.check}</span>
                </div>
              ))}
            </div>
            <div className="security-card">
              <div className="security-card-title">Content Safety</div>
              {result.security.content_safety.map((c) => (
                <div key={c.check} className="security-item">
                  <StatusBadge
                    status={
                      c.status === "passed"
                        ? "pass"
                        : c.status === "unknown"
                        ? "warn"
                        : "fail"
                    }
                  />
                  <span>{c.check}</span>
                </div>
              ))}
            </div>
            <div className="security-card">
              <div className="security-card-title">Evaluation</div>
              {result.evaluation ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  <div className="security-item">
                    <span style={{ color: "var(--color-text-tertiary)" }}>Test Cases:</span>
                    <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{result.evaluation.test_count}</span>
                  </div>
                  <div className="security-item">
                    <span style={{ color: "var(--color-text-tertiary)" }}>Passed:</span>
                    <span style={{ fontWeight: 600, color: "var(--color-pass)" }}>{result.evaluation.passed}</span>
                  </div>
                  <div className="security-item">
                    <span style={{ color: "var(--color-text-tertiary)" }}>Accuracy:</span>
                    <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{result.evaluation.accuracy}%</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm" style={{ color: "var(--color-text-disabled)" }}>Evaluation skipped</div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div
            className="card"
            style={{
              borderLeft: `4px solid ${result.summary.errors === 0 ? "var(--color-pass)" : "var(--color-warn)"}`,
              fontSize: "13px",
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
              {result.mode === "live" ? "Live" : "Simulated"} Deployment:
            </span>{" "}
            {result.summary.agents_deployed} agents deployed |{" "}
            {result.summary.tools_registered} tools registered |{" "}
            {result.summary.errors} errors |{" "}
            {result.summary.total_duration_ms < 1000
              ? `${result.summary.total_duration_ms}ms`
              : `${(result.summary.total_duration_ms / 1000).toFixed(1)}s`}{" "}
            total | Pipeline: <span style={{ fontFamily: "var(--font-mono)" }}>{result.pipeline_id}</span>
          </div>
        </>
      )}
    </div>
  );
}
