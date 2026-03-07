import React, { useState, useEffect } from "react";
import { useApi } from "../hooks/useApi.js";
import { JsonViewer } from "../components/shared/JsonViewer.js";

interface McpTool {
  name: string;
  description?: string;
}

interface McpServer {
  name: string;
  port: number;
  status: "online" | "offline";
  tools: McpTool[];
}

const TOOL_HINTS: Record<string, string> = {
  upload_contract: '{"text": "This Non-Disclosure Agreement between Acme Corp and Beta Inc..."}',
  classify_document: '{"text": "This Non-Disclosure Agreement between Acme Corp and Beta Inc..."}',
  extract_metadata: '{"text": "Agreement between Acme Corp and Beta Inc effective Jan 15 2026..."}',
  extract_clauses: '{"text": "Confidentiality: Each party agrees to keep all proprietary information confidential..."}',
  identify_parties: '{"text": "between Acme Corp (Disclosing Party) and Beta Inc (Receiving Party)"}',
  extract_dates_values: '{"text": "effective January 15, 2026... amount not to exceed $500,000"}',
  check_policy: '{"clauses": [{"type":"liability","text":"Liability shall not exceed $1M"}]}',
  flag_risk: '{"clauses": [{"type":"liability","text":"Liability shall not exceed $1M"}]}',
  get_policy_rules: "{}",
  check_clause_compliance: '{"clause": {"type":"confidentiality","text":"..."},"policy":"standard"}',
  validate_jurisdiction: '{"jurisdiction": "US-CA", "contract_type": "NDA"}',
  check_regulatory_requirements: '{"contract_type": "NDA", "jurisdiction": "US-CA"}',
  route_approval: '{"contract_id": "NDA-001", "risk_level": "medium"}',
  escalate_to_human: '{"contract_id": "NDA-001", "reason": "Liability exceeds threshold"}',
  notify_stakeholder: '{"contract_id": "NDA-001", "stakeholder": "legal@acme.com"}',
  get_audit_trail: '{"contract_id": "NDA-001"}',
  log_event: '{"contract_id": "NDA-001", "event": "reviewed", "agent": "compliance"}',
  generate_report: '{"contract_id": "NDA-001"}',
  run_evaluation: '{"contract_id": "NDA-001", "metrics": ["accuracy","completeness"]}',
  compare_baseline: '{"contract_id": "NDA-001"}',
  get_eval_history: "{}",
  check_llm_drift: '{"model": "gpt-4o", "window_days": 7}',
  check_data_drift: '{"source": "contracts", "window_days": 7}',
  get_drift_history: "{}",
  submit_feedback: '{"contract_id": "NDA-001", "agent": "extraction", "rating": 4, "comment": "Good"}',
  get_feedback_summary: '{"agent": "extraction"}',
  apply_feedback: '{"agent": "extraction", "action": "update_prompt"}',
};

export function BuildConsole() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [selectedTool, setSelectedTool] = useState("");
  const [input, setInput] = useState("{}");
  const [loadingServers, setLoadingServers] = useState(true);
  const { data, loading, error, post } = useApi<unknown>();

  async function loadServers() {
    setLoadingServers(true);
    try {
      const resp = await fetch("/api/v1/tools");
      if (resp.ok) {
        const json = await resp.json();
        const list: McpServer[] = json.servers ?? [];
        setServers(list);
        if (list.length > 0 && !selectedServer) {
          setSelectedServer(list[0].name);
          if (list[0].tools.length > 0) {
            setSelectedTool(list[0].tools[0].name);
            setInput(TOOL_HINTS[list[0].tools[0].name] ?? "{}");
          }
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingServers(false);
    }
  }

  useEffect(() => { loadServers(); }, []);

  const currentServer = servers.find((s) => s.name === selectedServer) ?? servers[0];
  const currentTool = currentServer?.tools.find((t) => t.name === selectedTool);

  function handleServerChange(name: string) {
    setSelectedServer(name);
    const server = servers.find((s) => s.name === name);
    if (server && server.tools.length > 0) {
      setSelectedTool(server.tools[0].name);
      setInput(TOOL_HINTS[server.tools[0].name] ?? "{}");
    }
  }

  function handleToolChange(name: string) {
    setSelectedTool(name);
    setInput(TOOL_HINTS[name] ?? "{}");
  }

  async function handleExecute() {
    try {
      const parsed = JSON.parse(input);
      await post("/tools/" + selectedServer + "/" + selectedTool, { input: parsed });
    } catch {
      /* input parsing error */
    }
  }

  const totalTools = servers.reduce((sum, s) => sum + s.tools.length, 0);
  const onlineCount = servers.filter((s) => s.status === "online").length;

  if (loadingServers) {
    return (
      <div className="animate-fade-in">
        <div className="view-header"><h2 className="view-title">Build Console</h2></div>
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>Loading MCP servers...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Build Console</h2>
        <button className="btn btn-secondary" style={{ fontSize: "12px" }} onClick={loadServers}>Refresh Servers</button>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-tertiary)" }}>Test individual MCP tools interactively</p>

      <div className="console-panels">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div>
            <div className="console-panel-label">MCP Server</div>
            <select value={selectedServer} onChange={(e) => handleServerChange(e.target.value)} className="select" style={{ width: "100%" }}>
              {servers.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} {s.status === "offline" ? "(offline)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="console-panel-label">Tool</div>
            <select value={selectedTool} onChange={(e) => handleToolChange(e.target.value)} className="select" style={{ width: "100%" }}>
              {(currentServer?.tools ?? []).map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          {currentTool?.description && (
            <p className="text-sm" style={{ color: "var(--color-text-tertiary)", fontStyle: "italic" }}>{currentTool.description}</p>
          )}

          <div>
            <div className="console-panel-label">Input JSON</div>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={8} className="textarea" />
          </div>

          <button onClick={handleExecute} disabled={loading || !currentServer || currentServer.status === "offline"} className="btn btn-primary">
            {loading ? "Executing..." : "Execute Tool"}
          </button>

          {error && <p className="text-sm" style={{ color: "var(--color-fail)" }}>{error}</p>}
        </div>

        <div>
          <div className="console-panel-label">Response</div>
          {data ? (
            <JsonViewer data={data} maxHeight="500px" />
          ) : (
            <div className="code-block" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
              Execute a tool to see the response
            </div>
          )}
        </div>
      </div>

      <div className="console-stats">
        <span>Servers: <strong style={{ color: "var(--color-text-primary)" }}>{servers.length}</strong> ({onlineCount} online)</span>
        <span>Tools: <strong style={{ color: "var(--color-text-primary)" }}>{totalTools}</strong></span>
        <span>Latency: <strong style={{ color: "var(--color-text-primary)" }}>--</strong></span>
      </div>

      {currentServer && (
        <div style={{ marginTop: "var(--space-lg)", background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)" }}>
          <div className="card-header">Tool Registry ({currentServer.name}) — {currentServer.status}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            {currentServer.tools.map((tool) => (
              <div key={tool.name} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontSize: "13px", color: "var(--color-text-secondary)" }}>
                <span className={"badge " + (currentServer.status === "online" ? "badge-pass" : "badge-fail")} style={{ padding: "2px 6px", borderRadius: "var(--radius-sm)", fontSize: "11px", fontWeight: 600 }}>
                  {currentServer.status === "online" ? "[READY]" : "[DOWN]"}
                </span>
                <span>{tool.name}</span>
                {tool.description && <span style={{ color: "var(--color-text-tertiary)", fontSize: "11px" }}>— {tool.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
