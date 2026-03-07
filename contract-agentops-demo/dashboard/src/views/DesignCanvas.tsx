import React from "react";
import { AgentCard } from "../components/shared/AgentCard.js";

const AGENTS = [
	{
		name: "Intake Agent",
		role: "Classify contracts by type and extract initial metadata",
		model: "GPT-4o",
		boundary: "Classify only",
		tools: ["upload_contract", "classify_document", "extract_metadata"],
	},
	{
		name: "Extraction Agent",
		role: "Extract key clauses, parties, dates, and monetary values",
		model: "GPT-4o",
		boundary: "Extract only",
		tools: ["extract_clauses", "identify_parties", "extract_dates_values"],
	},
	{
		name: "Compliance Agent",
		role: "Check extracted terms against company policies and flag risks",
		model: "GPT-4o",
		boundary: "Flag only",
		tools: ["check_policy", "flag_risk", "get_policy_rules"],
	},
	{
		name: "Approval Agent",
		role: "Route contracts for approval or escalate to human review",
		model: "GPT-4o",
		boundary: "Route only",
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
						<AgentCard
							name={agent.name}
							role={agent.role}
							model={agent.model}
							boundary={agent.boundary}
							tools={agent.tools}
						/>
						{i < AGENTS.length - 1 && (
							<div className="pipeline-arrow">{"\u2192"}</div>
						)}
					</React.Fragment>
				))}
			</div>

			<div className="agent-inventory">
				<span>
					<strong style={{ color: "var(--color-text-primary)" }}>4</strong>{" "}
					Agents
				</span>
				<span>
					<strong style={{ color: "var(--color-text-primary)" }}>12</strong> MCP
					Tools
				</span>
				<span>
					<strong style={{ color: "var(--color-text-primary)" }}>8</strong> MCP
					Servers
				</span>
				<span>
					Model:{" "}
					<strong
						style={{
							color: "var(--color-text-primary)",
							fontFamily: "var(--font-mono)",
						}}
					>
						GPT-4o
					</strong>
				</span>
				<span>
					Pipeline:{" "}
					<strong style={{ color: "var(--color-text-primary)" }}>
						Sequential + HITL
					</strong>
				</span>
			</div>
		</div>
	);
}
