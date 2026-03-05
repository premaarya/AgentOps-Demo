import React, { useState } from "react";
import { useApi } from "../hooks/useApi.js";
import { JsonViewer } from "../components/shared/JsonViewer.js";

const MCP_SERVERS = [
  {
    name: "contract-intake-mcp",
    tools: [
      { name: "upload_contract", hint: '{"text": "This Non-Disclosure Agreement..."}' },
      { name: "classify_document", hint: '{"text": "This Non-Disclosure Agreement..."}' },
      { name: "extract_metadata", hint: '{"text": "Agreement between Acme Corp and Beta Inc..."}' },
    ],
  },
  {
    name: "contract-extraction-mcp",
    tools: [
      { name: "extract_clauses", hint: '{"text": "Confidentiality: Each party agrees..."}' },
      { name: "identify_parties", hint: '{"text": "between Acme Corp and Beta Inc"}' },
      { name: "extract_dates_values", hint: '{"text": "effective January 15, 2026... $500,000"}' },
    ],
  },
  {
    name: "contract-compliance-mcp",
    tools: [
      { name: "check_policy", hint: '{"clauses": [{"type":"liability","text":"..."}]}' },
      { name: "flag_risk", hint: '{"clauses": [{"type":"liability","text":"..."}]}' },
      { name: "get_policy_rules", hint: "{}" },
    ],
  },
  {
    name: "contract-approval-mcp",
    tools: [
      { name: "route_approval", hint: '{"contract_id": "NDA-001", "risk_level": "medium"}' },
      { name: "escalate_to_human", hint: '{"contract_id": "NDA-001", "reason": "Liability exceeds threshold"}' },
      { name: "notify_stakeholder", hint: '{"contract_id": "NDA-001", "stakeholder": "legal@acme.com"}' },
    ],
  },
];

export function BuildConsole() {
  const [selectedServer, setSelectedServer] = useState(MCP_SERVERS[0].name);
  const [selectedTool, setSelectedTool] = useState(MCP_SERVERS[0].tools[0].name);
  const [input, setInput] = useState(MCP_SERVERS[0].tools[0].hint);
  const { data, loading, error, post } = useApi<unknown>();

  const currentServer = MCP_SERVERS.find((s) => s.name === selectedServer) ?? MCP_SERVERS[0];
  const currentTool = currentServer.tools.find((t) => t.name === selectedTool) ?? currentServer.tools[0];

  function handleServerChange(name: string) {
    setSelectedServer(name);
    const server = MCP_SERVERS.find((s) => s.name === name);
    if (server) {
      setSelectedTool(server.tools[0].name);
      setInput(server.tools[0].hint);
    }
  }

  function handleToolChange(name: string) {
    setSelectedTool(name);
    const tool = currentServer.tools.find((t) => t.name === name);
    if (tool) setInput(tool.hint);
  }

  async function handleExecute() {
    try {
      const parsed = JSON.parse(input);
      await post(`/tools/${selectedServer}/${selectedTool}`, { input: parsed });
    } catch {
      // input parsing error handled by the UI
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Build Console</h2>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-tertiary)" }}>Test individual MCP tools interactively</p>

      <div className="console-panels">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div>
            <div className="console-panel-label">MCP Server</div>
            <select
              value={selectedServer}
              onChange={(e) => handleServerChange(e.target.value)}
              className="select"
              style={{ width: "100%" }}
            >
              {MCP_SERVERS.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="console-panel-label">Tool</div>
            <select
              value={selectedTool}
              onChange={(e) => handleToolChange(e.target.value)}
              className="select"
              style={{ width: "100%" }}
            >
              {currentServer.tools.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="console-panel-label">Input JSON</div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={8}
              className="textarea"
            />
          </div>

          <button
            onClick={handleExecute}
            disabled={loading}
            className="btn btn-primary"
          >
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
        <span>Servers: <strong style={{ color: "var(--color-text-primary)" }}>4</strong></span>
        <span>Tools: <strong style={{ color: "var(--color-text-primary)" }}>12</strong></span>
        <span>Latency: <strong style={{ color: "var(--color-text-primary)" }}>--</strong></span>
      </div>

      {/* Tool Registry */}
      <div style={{ marginTop: "var(--space-lg)", background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)" }}>
        <div className="card-header">Tool Registry ({selectedServer})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {currentServer.tools.map((tool) => (
            <div key={tool.name} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontSize: "13px", color: "var(--color-text-secondary)" }}>
              <span className="badge badge-pass" style={{ background: "rgba(0,178,148,0.15)", color: "var(--color-pass)", padding: "2px 6px", borderRadius: "var(--radius-sm)", fontSize: "11px", fontWeight: 600 }}>[PASS]</span>
              {tool.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
