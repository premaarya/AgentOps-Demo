import React, { useState } from "react";
import { StatusBadge } from "../components/shared/StatusBadge";
import { useAppContext } from "../context/AppContext";
import { useApi } from "../hooks/useApi";

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

const STAGE_NAMES = ["Build", "Test", "Deploy", "Register"];

const DEFAULT_AGENTS: FoundryAgentInfo[] = [
	{
		agent_name: "Intake Agent",
		foundry_agent_id: "-",
		model: "GPT-4o",
		status: "registered",
		tools_count: 3,
	},
	{
		agent_name: "Extraction Agent",
		foundry_agent_id: "-",
		model: "GPT-4o",
		status: "registered",
		tools_count: 3,
	},
	{
		agent_name: "Compliance Agent",
		foundry_agent_id: "-",
		model: "GPT-4o",
		status: "registered",
		tools_count: 3,
	},
	{
		agent_name: "Approval Agent",
		foundry_agent_id: "-",
		model: "GPT-4o",
		status: "registered",
		tools_count: 3,
	},
];

const DEFAULT_SECURITY = {
	identity_access: [
		{ check: "Entra ID assigned", status: "passed" },
		{ check: "RBAC configured", status: "passed" },
		{ check: "Conditional access applied", status: "passed" },
	],
	content_safety: [
		{ check: "Content filters ON", status: "passed" },
		{ check: "XPIA protection ON", status: "passed" },
		{ check: "PII redaction ON", status: "passed" },
	],
};

export function DeployDashboard() {
	const { post, loading } = useApi<DeployResult>();
	const { demoMode } = useAppContext();
	const [result, setResult] = useState<DeployResult | null>(null);
	const [animStage, setAnimStage] = useState(-1);

	async function runDeploy() {
		setAnimStage(0);
		setResult(null);

		const data = await post("/deploy/pipeline", {});
		if (data) {
			for (let i = 0; i < data.stages.length; i++) {
				setAnimStage(i);
				await new Promise((r) => setTimeout(r, 600));
			}
			setAnimStage(data.stages.length);
			setResult(data);
		} else {
			// Simulated fallback when API is not available
			for (let i = 0; i < STAGE_NAMES.length; i++) {
				setAnimStage(i);
				await new Promise((r) => setTimeout(r, 600));
			}
			setAnimStage(STAGE_NAMES.length);
			setResult({
				pipeline_id: "sim-" + Date.now(),
				mode: "simulated",
				stages: STAGE_NAMES.map((name) => ({
					name,
					status: "passed" as const,
					duration_ms: Math.floor(Math.random() * 2000) + 500,
				})),
				agents: DEFAULT_AGENTS,
				security: DEFAULT_SECURITY,
				summary: {
					agents_deployed: 4,
					tools_registered: 12,
					errors: 0,
					total_duration_ms: 3200,
				},
			});
		}
	}

	function stageLabel(status: string): string {
		switch (status) {
			case "passed":
				return "[PASS]";
			case "failed":
				return "[FAIL]";
			case "skipped":
				return "[SKIP]";
			default:
				return "Pending";
		}
	}

	const agents = result?.agents ?? DEFAULT_AGENTS;
	const security = result?.security ?? DEFAULT_SECURITY;
	const summary = result?.summary;

	return (
		<div
			className="animate-fade-in"
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "var(--space-lg)",
			}}
		>
			<div className="view-header">
				<h2 className="view-title">Deploy Dashboard</h2>
				<button
					onClick={runDeploy}
					disabled={loading}
					className="btn btn-primary"
				>
					{loading ? "Deploying..." : "Deploy Pipeline \u2192"}
				</button>
			</div>

			{/* 4-stage Deployment Pipeline */}
			<div>
				<h3
					className="section-header"
					style={{
						fontSize: "14px",
						fontWeight: 600,
						color: "var(--color-text-secondary)",
						marginBottom: "var(--space-md)",
					}}
				>
					Deployment Pipeline
				</h3>
				<div className="deploy-pipeline">
					{STAGE_NAMES.map((name, i) => {
						const stage = result?.stages[i];
						const isActive = animStage === i;
						const isDone = animStage > i;

						let stageClass = "deploy-stage";
						if (isDone && stage) {
							stageClass +=
								stage.status === "passed"
									? " passed"
									: stage.status === "failed"
										? " failed"
										: "";
						} else if (isActive) {
							stageClass += " active";
						}

						return (
							<React.Fragment key={name}>
								<div className={stageClass}>
									<div className="deploy-stage-name">{name}</div>
									<div className="deploy-stage-status">
										{isDone && stage ? (
											<span
												className={`badge ${stage.status === "passed" ? "badge-pass" : stage.status === "failed" ? "badge-fail" : "badge-warn"}`}
											>
												{stageLabel(stage.status)}
											</span>
										) : isActive ? (
											<span className="badge badge-info animate-pulse-custom">
												Running...
											</span>
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
								{i < STAGE_NAMES.length - 1 && (
									<span className="deploy-arrow">{"\u2192"}</span>
								)}
							</React.Fragment>
						);
					})}
				</div>
			</div>

			{/* Agent Registration - always visible */}
			<div>
				<h3
					className="section-header"
					style={{
						fontSize: "14px",
						fontWeight: 600,
						color: "var(--color-text-secondary)",
						marginBottom: "var(--space-md)",
					}}
				>
					Agent 365 Registration
				</h3>
				<table className="data-table">
					<thead>
						<tr>
							<th>Agent</th>
							<th>Entra Agent ID</th>
							<th>Model</th>
							<th>Tools</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{result ? (
							agents.map((agent) => (
								<tr key={agent.agent_name}>
									<td style={{ fontWeight: 600 }}>{agent.agent_name}</td>
									<td
										style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
									>
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
							))
						) : (
							<tr>
								<td
									colSpan={5}
									style={{
										color: "var(--color-text-disabled)",
										textAlign: "center",
										padding: "24px",
									}}
								>
									Click &quot;Deploy Pipeline&quot; to begin registration
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{/* Security Grid - 2 columns matching prototype */}
			<div className="security-grid">
				<div className="security-card">
					<div className="security-card-title">Identity & Access</div>
					{security.identity_access.map((c) => (
						<div key={c.check} className="security-item">
							<StatusBadge status={c.status === "passed" ? "pass" : "fail"} />
							<span>{c.check}</span>
						</div>
					))}
				</div>
				<div className="security-card">
					<div className="security-card-title">Content Safety</div>
					{security.content_safety.map((c) => (
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
			</div>

			{/* Deploy Summary */}
			<div className="deploy-summary">
				{summary
					? `${summary.agents_deployed} agents deployed | ${summary.tools_registered} tools registered | ${summary.errors} errors`
					: "4 agents ready | 12 tools registered | 0 errors"}
			</div>
		</div>
	);
}
