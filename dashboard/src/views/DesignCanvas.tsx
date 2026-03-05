import React from "react";
import { AgentCard } from "../components/shared/AgentCard.js";

const AGENTS = [
  {
    name: "Intake Agent",
    role: "Classify contracts by type and extract initial metadata",
    tools: ["upload_contract", "classify_document", "extract_metadata"],
  },
  {
    name: "Extraction Agent",
    role: "Extract key clauses, parties, dates, and monetary values",
    tools: ["extract_clauses", "identify_parties", "extract_dates_values"],
  },
  {
    name: "Compliance Agent",
    role: "Check extracted terms against company policies and flag risks",
    tools: ["check_policy", "flag_risk", "get_policy_rules"],
  },
  {
    name: "Approval Agent",
    role: "Route contracts for approval or escalate to human review",
    tools: ["route_approval", "escalate_to_human", "notify_stakeholder"],
  },
];

export function DesignCanvas() {
  return (
    <div className="animate-fade-in">
      <div className="view-header">
        <h2 className="view-title">Agent Design Canvas</h2>
      </div>

      <div className="agent-pipeline">
        {AGENTS.map((agent, i) => (
          <React.Fragment key={agent.name}>
            <AgentCard name={agent.name} role={agent.role} tools={agent.tools} />
            {i < AGENTS.length - 1 && (
              <div className="pipeline-arrow">-&gt;</div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="agent-inventory">
        <span><strong style={{ color: "var(--color-text-primary)" }}>4</strong> Agents</span>
        <span><strong style={{ color: "var(--color-text-primary)" }}>12</strong> MCP Tools</span>
        <span><strong style={{ color: "var(--color-text-primary)" }}>3</strong> MCP Servers</span>
        <span>Model: <strong style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>gpt-4o</strong></span>
      </div>
    </div>
  );
}
