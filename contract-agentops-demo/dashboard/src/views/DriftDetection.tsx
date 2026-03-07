import React, { useEffect, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { StatusBadge } from "../components/shared/StatusBadge";
import { useApi } from "../hooks/useApi";

interface DriftTimeline {
	week: string;
	accuracy: number;
}

interface DriftAlert {
	type: string;
	message: string;
	severity: "info" | "warning" | "critical";
	detected_at: string;
}

interface LlmDrift {
	id: string;
	timeline: DriftTimeline[];
	alerts: DriftAlert[];
}

interface DataDrift {
	id: string;
	timeline: DriftTimeline[];
	distribution: Record<string, number>;
	alerts: DriftAlert[];
}

interface ModelSwap {
	gpt4o: { accuracy: number; latency_ms: number; cost_per_contract: number };
	gpt4o_mini: {
		accuracy: number;
		latency_ms: number;
		cost_per_contract: number;
	};
	comparison: {
		accuracy_delta: number;
		latency_delta: number;
		cost_delta: number;
	};
}

const DISTRIBUTION_COLORS = [
	"#0078D4",
	"#00B294",
	"#FFB900",
	"#8861C4",
	"#E74C3C",
	"#FF8C00",
];

export function DriftDetection() {
	const { get, post, loading } = useApi();
	const [llmDrift, setLlmDrift] = useState<LlmDrift | null>(null);
	const [dataDrift, setDataDrift] = useState<DataDrift | null>(null);
	const [modelSwap, setModelSwap] = useState<ModelSwap | null>(null);

	useEffect(() => {
		loadDrift();
	}, []);

	async function loadDrift() {
		const llm = (await get("/drift/llm")) as LlmDrift | null;
		const data = (await get("/drift/data")) as DataDrift | null;
		if (llm) setLlmDrift(llm);
		if (data) setDataDrift(data);
	}

	async function runModelSwap() {
		const data = (await post("/drift/model-swap", {})) as ModelSwap | null;
		if (data) setModelSwap(data);
	}

	const chartTimeline =
		llmDrift?.timeline.map((d) => ({
			...d,
			accuracy: Math.round(d.accuracy * 100),
		})) ?? [];

	const distData = dataDrift
		? Object.entries(dataDrift.distribution).map(([name, pct]) => ({
				name,
				percentage: Math.round(pct * 100),
			}))
		: [];

	const knownTypes = ["NDA", "MSA", "SOW", "Amendment", "SLA"];

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
				<div>
					<h2 className="view-title">Drift Detection Center</h2>
					<p
						className="text-sm"
						style={{ color: "var(--color-text-tertiary)" }}
					>
						Monitor LLM drift, data drift, and model swap impact
					</p>
				</div>
				<span style={{ fontSize: "12px", color: "var(--color-text-disabled)" }}>
					Time Range: Last 30 days
				</span>
			</div>

			<div className="drift-charts">
				{/* LLM Drift */}
				<div className="chart-card">
					<div className="chart-title">
						LLM Drift - Extraction Accuracy Over Time
					</div>
					{chartTimeline.length > 0 ? (
						<ResponsiveContainer width="100%" height={200}>
							<LineChart data={chartTimeline}>
								<CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
								<XAxis
									dataKey="week"
									tick={{ fontSize: 11, fill: "#A0A0A0" }}
									stroke="#3A3A3A"
								/>
								<YAxis
									domain={[75, 95]}
									tick={{ fontSize: 11, fill: "#A0A0A0" }}
									stroke="#3A3A3A"
								/>
								<Tooltip
									contentStyle={{
										background: "#2D2D2D",
										border: "1px solid #3A3A3A",
										borderRadius: "8px",
										color: "#F2F2F2",
									}}
								/>
								<ReferenceLine
									y={85}
									stroke="#E74C3C"
									strokeDasharray="5 5"
									label={{
										value: "Threshold 85%",
										fill: "#E74C3C",
										fontSize: 10,
									}}
								/>
								<Line
									type="monotone"
									dataKey="accuracy"
									stroke="#50E6FF"
									strokeWidth={2}
									dot={{ r: 4, fill: "#50E6FF" }}
									name="Accuracy %"
								/>
							</LineChart>
						</ResponsiveContainer>
					) : (
						<div
							style={{
								height: "200px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								color: "var(--color-text-disabled)",
							}}
						>
							Loading drift data...
						</div>
					)}
					{llmDrift?.alerts.map((a, i) => (
						<div
							key={i}
							style={{
								display: "flex",
								alignItems: "center",
								gap: "var(--space-sm)",
								marginTop: "var(--space-sm)",
								fontSize: "12px",
							}}
						>
							<StatusBadge
								status={
									a.severity === "critical"
										? "fail"
										: a.severity === "warning"
											? "warn"
											: "info"
								}
							/>
							<span>{a.message}</span>
						</div>
					))}
				</div>

				{/* Data Drift */}
				<div className="chart-card">
					<div className="chart-title">
						Data Drift - Contract Type Distribution
					</div>
					{distData.length > 0 ? (
						<ResponsiveContainer width="100%" height={200}>
							<BarChart data={distData} layout="vertical">
								<CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
								<XAxis
									type="number"
									domain={[0, 50]}
									tick={{ fontSize: 11, fill: "#A0A0A0" }}
									stroke="#3A3A3A"
								/>
								<YAxis
									dataKey="name"
									type="category"
									tick={{ fontSize: 11, fill: "#A0A0A0" }}
									width={90}
									stroke="#3A3A3A"
								/>
								<Tooltip
									contentStyle={{
										background: "#2D2D2D",
										border: "1px solid #3A3A3A",
										borderRadius: "8px",
										color: "#F2F2F2",
									}}
								/>
								<Bar dataKey="percentage" name="% of contracts">
									{distData.map((entry, index) => (
										<Cell
											key={entry.name}
											fill={
												knownTypes.includes(entry.name)
													? DISTRIBUTION_COLORS[
															index % DISTRIBUTION_COLORS.length
														]
													: "#FF8C00"
											}
										/>
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div
							style={{
								height: "200px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								color: "var(--color-text-disabled)",
							}}
						>
							Loading distribution...
						</div>
					)}
					{dataDrift?.alerts.map((a, i) => (
						<div
							key={i}
							style={{
								display: "flex",
								alignItems: "center",
								gap: "var(--space-sm)",
								marginTop: "var(--space-sm)",
								fontSize: "12px",
							}}
						>
							<StatusBadge
								status={
									a.severity === "critical"
										? "fail"
										: a.severity === "warning"
											? "warn"
											: "info"
								}
							/>
							<span>{a.message}</span>
						</div>
					))}
				</div>
			</div>

			{/* Model Swap */}
			<div className="card">
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: "var(--space-lg)",
					}}
				>
					<div className="card-header" style={{ marginBottom: 0 }}>
						Model Swap Analysis
					</div>
					<button
						onClick={runModelSwap}
						disabled={loading}
						className="btn btn-warning"
					>
						{loading ? "Simulating..." : "Simulate Swap ->"}
					</button>
				</div>
				{modelSwap && (
					<div className="model-swap">
						<div className="model-card">
							<div className="model-card-title">Current: GPT-4o</div>
							<div className="model-stat">
								<span className="model-stat-label">Accuracy</span>
								<span className="model-stat-value">
									{(modelSwap.gpt4o.accuracy * 100).toFixed(1)}%
								</span>
							</div>
							<div className="model-stat">
								<span className="model-stat-label">Latency</span>
								<span className="model-stat-value">
									{modelSwap.gpt4o.latency_ms}ms
								</span>
							</div>
							<div className="model-stat">
								<span className="model-stat-label">Cost/1K</span>
								<span className="model-stat-value">
									${(modelSwap.gpt4o.cost_per_contract * 1000).toFixed(2)}
								</span>
							</div>
						</div>
						<div className="model-card">
							<div className="model-card-title">Candidate: GPT-4o-mini</div>
							<div className="model-stat">
								<span className="model-stat-label">Accuracy</span>
								<span className="model-stat-value">
									{(modelSwap.gpt4o_mini.accuracy * 100).toFixed(1)}%
								</span>
							</div>
							<div className="model-stat">
								<span className="model-stat-label">Latency</span>
								<span className="model-stat-value">
									{modelSwap.gpt4o_mini.latency_ms}ms
								</span>
							</div>
							<div className="model-stat">
								<span className="model-stat-label">Cost/1K</span>
								<span className="model-stat-value">
									${(modelSwap.gpt4o_mini.cost_per_contract * 1000).toFixed(2)}
								</span>
							</div>
						</div>
						<div
							className={`quality-gate ${Math.abs(modelSwap.comparison.accuracy_delta) <= 0.05 ? "pass" : "fail"}`}
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<div className="quality-gate-label">VERDICT</div>
							<div className="quality-gate-status">
								{Math.abs(modelSwap.comparison.accuracy_delta) <= 0.05
									? "ACCEPTABLE"
									: "DEGRADED"}
							</div>
							<div
								style={{
									fontSize: "12px",
									color: "var(--color-text-tertiary)",
									marginTop: "var(--space-sm)",
								}}
							>
								<div>
									Accuracy:{" "}
									{(modelSwap.comparison.accuracy_delta * 100).toFixed(1)}%
								</div>
								<div>
									Cost: {(modelSwap.comparison.cost_delta * 100).toFixed(0)}%
								</div>
								<div>
									Latency:{" "}
									{(modelSwap.comparison.latency_delta * 100).toFixed(0)}%
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Recommended Actions */}
			<div className="recommended-actions">
				<div className="card-header">Recommended Actions</div>
				{llmDrift?.alerts.some(
					(a) => a.severity === "critical" || a.severity === "warning",
				) && (
					<div className="action-item">
						<span className="action-icon warning">[!]</span>
						<span>
							Update compliance rules for AI liability clause (data drift)
						</span>
					</div>
				)}
				{dataDrift?.alerts.some((a) => a.severity === "warning") && (
					<div className="action-item">
						<span className="action-icon warning">[!]</span>
						<span>Retrain extraction prompts on new contract types</span>
					</div>
				)}
				<div className="action-item">
					<span className="action-icon info">[i]</span>
					<span>Consider GPT-4o-mini swap for non-critical extractions</span>
				</div>
				<div className="action-item">
					<span className="action-icon info">[i]</span>
					<span>Schedule weekly drift monitoring alerts</span>
				</div>
			</div>
		</div>
	);
}
