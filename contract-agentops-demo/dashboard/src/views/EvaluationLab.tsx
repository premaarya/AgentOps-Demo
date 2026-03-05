import React, { useState, useEffect } from "react";
import { useApi } from "../hooks/useApi";
import { MetricCard } from "../components/shared/MetricCard";
import { StatusBadge } from "../components/shared/StatusBadge";

interface JudgeScores {
  relevance: number;
  groundedness: number;
  coherence: number;
}

interface EvalResult {
  id: string;
  version: string;
  run_at: string;
  total_cases: number;
  passed: number;
  accuracy: number;
  per_metric: Record<string, number>;
  quality_gate: "PASS" | "FAIL";
  judge_scores?: JudgeScores;
}

interface BaselineComparison {
  baseline: EvalResult;
  current: EvalResult | null;
  delta: { accuracy: number; relevance: number; groundedness: number; coherence: number } | null;
}

export function EvaluationLab() {
  const { get, post, loading } = useApi<EvalResult[] | EvalResult>();
  const [results, setResults] = useState<EvalResult[]>([]);
  const [latest, setLatest] = useState<EvalResult | null>(null);
  const [baseline, setBaseline] = useState<BaselineComparison | null>(null);
  const [version, setVersion] = useState("v1.3");

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    const data = await get("/api/v1/evaluations/results") as EvalResult[] | null;
    if (data && Array.isArray(data)) {
      setResults(data);
      if (data.length > 0) setLatest(data[data.length - 1]);
    }
    const bl = await get("/api/v1/evaluations/baseline") as unknown as BaselineComparison | null;
    if (bl) setBaseline(bl);
  }

  async function runSuite() {
    const data = await post("/api/v1/evaluations/run", { version }) as EvalResult | null;
    if (data && "id" in data) {
      setLatest(data);
      setResults((prev) => [...prev, data]);
      await loadResults();
    }
  }

  const metrics = latest?.per_metric ?? {};
  const judge = latest?.judge_scores;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      <div className="view-header">
        <div>
          <h2 className="view-title">Evaluation Lab</h2>
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Ground-truth metrics + LLM-as-judge scoring + quality gates
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="input"
            style={{ width: "80px" }}
            placeholder="v1.3"
          />
          <button onClick={runSuite} disabled={loading} className="btn btn-danger">
            {loading ? "Running..." : "Run Suite ->"}
          </button>
        </div>
      </div>

      <div className="eval-layout">
        {/* Test Suite Config */}
        <div className="eval-config">
          <div className="card-header">Config</div>
          <div className="eval-config-label">Test Set</div>
          <div className="eval-config-value">{latest?.total_cases ?? 20} contracts</div>
          <div className="eval-config-label">Coverage</div>
          <div className="eval-config-value">95%</div>
          <div className="eval-config-label">Last Run</div>
          <div className="eval-config-value" style={{ fontSize: "12px" }}>{latest ? new Date(latest.run_at).toLocaleTimeString() : "Never"}</div>
          <div className="eval-config-label">Baseline</div>
          <div className="eval-config-value">{baseline?.baseline?.version ?? "v1.2"}</div>
          <div className="eval-config-label">Current</div>
          <div className="eval-config-value">{latest?.version ?? "N/A"}</div>

          {latest && (
            <div className={`quality-gate ${latest.quality_gate === "PASS" ? "pass" : "fail"}`} style={{ marginTop: "var(--space-lg)" }}>
              <div className="quality-gate-label">Quality Gate</div>
              <div className="quality-gate-status">[{latest.quality_gate}]</div>
              <div style={{ fontSize: "11px", color: "var(--color-text-tertiary)", marginTop: "var(--space-xs)" }}>
                {latest.quality_gate === "PASS" ? "Ready to deploy" : "Blocking deployment"}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {latest && (
            <>
              <div className="eval-overall">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)" }}>
                  <span>Overall</span>
                  <span style={{ fontSize: "18px" }}>
                    {latest.passed}/{latest.total_cases} passed ({latest.accuracy}%)
                  </span>
                </div>
                <div className="progress-bar" style={{ height: "8px" }}>
                  <div className="progress-fill" style={{
                    width: `${latest.accuracy}%`,
                    background: latest.accuracy >= 85 ? "var(--color-pass)" : latest.accuracy >= 70 ? "var(--color-warn)" : "var(--color-fail)",
                  }} />
                </div>
              </div>

              {/* Ground Truth Metrics */}
              <div className="card">
                <div className="card-header">Ground-Truth Metrics</div>
                <div className="metric-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                  <MetricCard
                    label="Extraction"
                    value={`${metrics.extraction_accuracy ?? 0}%`}
                    subtitle={Number(metrics.extraction_accuracy) >= 85 ? "PASS" : "FAIL"}
                    trend={Number(metrics.extraction_accuracy) >= 85 ? "up" : "down"}
                  />
                  <MetricCard
                    label="Compliance"
                    value={`${metrics.compliance_accuracy ?? 0}%`}
                    subtitle={Number(metrics.compliance_accuracy) >= 80 ? "PASS" : "WARN"}
                    trend={Number(metrics.compliance_accuracy) >= 80 ? "up" : "down"}
                  />
                  <MetricCard
                    label="Classification"
                    value={`${metrics.classification_accuracy ?? 0}%`}
                    subtitle={Number(metrics.classification_accuracy) >= 90 ? "PASS" : "FAIL"}
                    trend={Number(metrics.classification_accuracy) >= 90 ? "up" : "down"}
                  />
                  <MetricCard
                    label="False Flags"
                    value={`${metrics.false_flag_rate ?? 0}%`}
                    subtitle={Number(metrics.false_flag_rate) <= 15 ? "PASS" : "WARN"}
                    trend={Number(metrics.false_flag_rate) <= 15 ? "up" : "down"}
                  />
                  <MetricCard
                    label="Latency P95"
                    value={`${metrics.latency_p95_s ?? 0}s`}
                    subtitle={Number(metrics.latency_p95_s) <= 5 ? "PASS" : "WARN"}
                    trend={Number(metrics.latency_p95_s) <= 5 ? "up" : "down"}
                  />
                </div>
              </div>

              {/* LLM-as-Judge Scores */}
              {judge && (
                <div className="card">
                  <div className="card-header">LLM-as-Judge Scores (GPT-4o)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-lg)" }}>
                    {(["relevance", "groundedness", "coherence"] as const).map((dim) => (
                      <div key={dim} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                          {judge[dim]}/5
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-tertiary)", textTransform: "capitalize", marginTop: "var(--space-xs)" }}>{dim}</div>
                        <div style={{ marginTop: "var(--space-sm)" }}>
                          <StatusBadge status={judge[dim] >= 4.0 ? "pass" : judge[dim] >= 3.0 ? "warn" : "fail"} />
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--color-text-disabled)", marginTop: "var(--space-xs)" }}>Threshold: &gt;=4.0</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Baseline Comparison */}
          {baseline?.delta && latest && (
            <div className="card">
              <div className="card-header">
                Baseline Comparison ({baseline.baseline.version} vs {latest.version})
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>{baseline.baseline.version}</th>
                    <th>{latest.version}</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Accuracy</td>
                    <td>{baseline.baseline.accuracy}%</td>
                    <td>{latest.accuracy}%</td>
                    <td style={{ color: baseline.delta.accuracy >= 0 ? "var(--color-pass)" : "var(--color-fail)" }}>
                      {baseline.delta.accuracy >= 0 ? "+" : ""}{baseline.delta.accuracy}%
                    </td>
                  </tr>
                  {baseline.baseline.judge_scores && (
                    <>
                      <tr>
                        <td>Relevance</td>
                        <td>{baseline.baseline.judge_scores.relevance}/5</td>
                        <td>{judge?.relevance ?? 0}/5</td>
                        <td style={{ color: baseline.delta.relevance >= 0 ? "var(--color-pass)" : "var(--color-fail)" }}>
                          {baseline.delta.relevance >= 0 ? "+" : ""}{baseline.delta.relevance}
                        </td>
                      </tr>
                      <tr>
                        <td>Groundedness</td>
                        <td>{baseline.baseline.judge_scores.groundedness}/5</td>
                        <td>{judge?.groundedness ?? 0}/5</td>
                        <td style={{ color: baseline.delta.groundedness >= 0 ? "var(--color-pass)" : "var(--color-fail)" }}>
                          {baseline.delta.groundedness >= 0 ? "+" : ""}{baseline.delta.groundedness}
                        </td>
                      </tr>
                      <tr>
                        <td>Coherence</td>
                        <td>{baseline.baseline.judge_scores.coherence}/5</td>
                        <td>{judge?.coherence ?? 0}/5</td>
                        <td style={{ color: baseline.delta.coherence >= 0 ? "var(--color-pass)" : "var(--color-fail)" }}>
                          {baseline.delta.coherence >= 0 ? "+" : ""}{baseline.delta.coherence}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-Contract Results */}
          {latest && (
            <div className="card">
              <div className="card-header">Per-Contract Results</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Classification</th>
                    <th>Extraction</th>
                    <th>Compliance</th>
                    <th>Judge Avg</th>
                    <th>Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "NDA-001", cls: "pass", ext: "pass", comp: "pass", judge: "4.7/5", overall: "pass" },
                    { id: "NDA-002", cls: "pass", ext: "pass", comp: "warn", judge: "4.5/5", overall: "pass" },
                    { id: "MSA-003", cls: "pass", ext: "fail", comp: "pass", judge: "3.8/5", overall: "fail" },
                    { id: "SOW-004", cls: "pass", ext: "pass", comp: "pass", judge: "4.6/5", overall: "pass" },
                    { id: "NDA-005", cls: "pass", ext: "pass", comp: "pass", judge: "4.8/5", overall: "pass" },
                  ].map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td><StatusBadge status={row.cls} /></td>
                      <td><StatusBadge status={row.ext} /></td>
                      <td><StatusBadge status={row.comp} /></td>
                      <td>{row.judge}</td>
                      <td><StatusBadge status={row.overall} /></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={6} style={{ color: "var(--color-text-disabled)", textAlign: "center" }}>
                      ...{(latest.total_cases ?? 20) - 5} more contracts
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
