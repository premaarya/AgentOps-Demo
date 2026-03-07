import React, { useEffect, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { MetricCard } from "../components/shared/MetricCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { useApi } from "../hooks/useApi";

interface AgentFeedback {
	positive: number;
	negative: number;
	satisfaction: number;
}

interface FeedbackSummary {
	total: number;
	positive: number;
	negative: number;
	converted_to_tests: number;
	by_agent: Record<string, AgentFeedback>;
	recent: Array<{
		id: string;
		contract_id: string;
		agent: string;
		sentiment: "positive" | "negative";
		comment: string;
		reviewer: string;
		submitted_at: string;
		converted_to_test: boolean;
	}>;
}

interface OptimizeResult {
	test_cases_created: number;
	feedbacks_converted: number;
}

export function FeedbackLoop() {
	const { get, post, loading } = useApi();
	const [summary, setSummary] = useState<FeedbackSummary | null>(null);
	const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(
		null,
	);
	const [selectedAgent, setSelectedAgent] = useState("extraction");
	const [prompt, setPrompt] = useState("");
	const [promptSaved, setPromptSaved] = useState(false);

	// Feedback form
	const [form, setForm] = useState({
		contract_id: "",
		agent: "extraction",
		sentiment: "negative",
		comment: "",
		reviewer: "",
	});

	useEffect(() => {
		loadSummary();
		loadPrompt("extraction");
	}, []);

	async function loadSummary() {
		const data = (await get("/feedback/summary")) as FeedbackSummary | null;
		if (data) setSummary(data);
	}

	async function loadPrompt(agent: string) {
		const data = (await get(`/prompts/${agent}`)) as { prompt: string } | null;
		if (data) setPrompt(data.prompt);
		setPromptSaved(false);
	}

	async function submitFeedback() {
		if (!form.contract_id || !form.comment) return;
		await post("/feedback", form);
		setForm({
			contract_id: "",
			agent: "extraction",
			sentiment: "negative",
			comment: "",
			reviewer: "",
		});
		await loadSummary();
	}

	async function runOptimize() {
		const data = (await post(
			"/feedback/optimize",
			{},
		)) as OptimizeResult | null;
		if (data) setOptimizeResult(data);
		await loadSummary();
	}

	async function savePrompt() {
		await post(`/prompts/${selectedAgent}`, { prompt });
		setPromptSaved(true);
	}

	const agentData = summary
		? Object.entries(summary.by_agent).map(([name, data]) => ({
				name,
				satisfaction: data.satisfaction,
				positive: data.positive,
				negative: data.negative,
			}))
		: [];

	const agents = ["intake", "extraction", "compliance", "approval"];

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
					<h2 className="view-title">Feedback & Improvement Loop</h2>
					<p
						className="text-sm"
						style={{ color: "var(--color-text-tertiary)" }}
					>
						Collect feedback, convert to test cases, refine agent prompts
					</p>
				</div>
			</div>

			{/* Metrics Row */}
			<div className="metric-grid">
				<MetricCard label="Total Feedback" value={summary?.total ?? 0} />
				<MetricCard label="Positive" value={summary?.positive ?? 0} />
				<MetricCard label="Negative" value={summary?.negative ?? 0} />
				<MetricCard
					label="Converted to Tests"
					value={summary?.converted_to_tests ?? 0}
				/>
			</div>

			<div className="feedback-layout">
				{/* Submit Feedback */}
				<div className="card">
					<div className="card-header">Submit Feedback</div>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "var(--space-md)",
						}}
					>
						<input
							type="text"
							placeholder="Contract ID (e.g., NDA-001)"
							value={form.contract_id}
							onChange={(e) =>
								setForm({ ...form, contract_id: e.target.value })
							}
							className="input"
						/>
						<div style={{ display: "flex", gap: "var(--space-sm)" }}>
							<select
								value={form.agent}
								onChange={(e) => setForm({ ...form, agent: e.target.value })}
								className="select"
								style={{ flex: 1 }}
							>
								{agents.map((a) => (
									<option key={a} value={a}>
										{a}
									</option>
								))}
							</select>
							<select
								value={form.sentiment}
								onChange={(e) =>
									setForm({ ...form, sentiment: e.target.value })
								}
								className="select"
								style={{ flex: 1 }}
							>
								<option value="positive">Positive</option>
								<option value="negative">Negative</option>
							</select>
						</div>
						<input
							type="text"
							placeholder="Reviewer name"
							value={form.reviewer}
							onChange={(e) => setForm({ ...form, reviewer: e.target.value })}
							className="input"
						/>
						<textarea
							placeholder="Describe what went right or wrong..."
							value={form.comment}
							onChange={(e) => setForm({ ...form, comment: e.target.value })}
							className="textarea"
							style={{ height: "80px", resize: "none" }}
						/>
						<button
							onClick={submitFeedback}
							disabled={loading || !form.contract_id || !form.comment}
							className="btn btn-primary"
							style={{ width: "100%" }}
						>
							Submit Feedback
						</button>
					</div>
				</div>

				{/* Agent Satisfaction Chart */}
				<div className="chart-card">
					<div className="chart-title">Agent Satisfaction (%)</div>
					{agentData.length > 0 ? (
						<ResponsiveContainer width="100%" height={220}>
							<BarChart data={agentData}>
								<CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
								<XAxis
									dataKey="name"
									tick={{ fontSize: 11, fill: "#A0A0A0" }}
									stroke="#3A3A3A"
								/>
								<YAxis
									domain={[0, 100]}
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
								<Bar
									dataKey="satisfaction"
									fill="#00B294"
									name="Satisfaction %"
								/>
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div
							style={{
								height: "220px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								color: "var(--color-text-disabled)",
							}}
						>
							No feedback data yet. Submit feedback to see trends.
						</div>
					)}
				</div>
			</div>

			{/* Improvement Cycle */}
			<div className="card">
				<div className="card-header">Improvement Cycle</div>
				{optimizeResult && (
					<div
						style={{
							background: "rgba(0, 178, 148, 0.1)",
							border: "1px solid rgba(0, 178, 148, 0.3)",
							borderRadius: "var(--radius-md)",
							padding: "var(--space-md)",
							marginBottom: "var(--space-lg)",
							fontSize: "13px",
							color: "var(--color-pass)",
						}}
					>
						Converted {optimizeResult.feedbacks_converted} negative feedback(s)
						into {optimizeResult.test_cases_created} test case(s).
					</div>
				)}
				<div className="cycle-steps">
					{/* Step 1: Convert Feedback */}
					<div
						className="cycle-step"
						style={{
							background: "var(--color-bg-elevated)",
							borderRadius: "var(--radius-md)",
							padding: "var(--space-md)",
						}}
					>
						<div className="cycle-step-title">Step 1: Convert Feedback</div>
						<div className="cycle-step-content">
							{summary
								? `${summary.negative} negative feedbacks ready to convert into eval test cases`
								: "No feedback yet"}
						</div>
						<button
							onClick={runOptimize}
							disabled={loading}
							className="btn btn-primary"
							style={{ marginTop: "var(--space-sm)" }}
						>
							{loading ? "Optimizing..." : "Optimize Now ->"}
						</button>
					</div>

					{/* Step 2: Update Prompt */}
					<div
						className="cycle-step"
						style={{
							background: "var(--color-bg-elevated)",
							borderRadius: "var(--radius-md)",
							padding: "var(--space-md)",
						}}
					>
						<div className="cycle-step-title">Step 2: Update Prompt</div>
						<textarea
							value={prompt}
							onChange={(e) => {
								setPrompt(e.target.value);
								setPromptSaved(false);
							}}
							className="textarea"
							style={{
								height: "100px",
								resize: "none",
								fontFamily: "var(--font-mono)",
								fontSize: "12px",
							}}
						/>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "var(--space-sm)",
								marginTop: "var(--space-sm)",
							}}
						>
							<select
								value={selectedAgent}
								onChange={(e) => {
									setSelectedAgent(e.target.value);
									loadPrompt(e.target.value);
								}}
								className="select"
								style={{ flex: 1 }}
							>
								{agents.map((a) => (
									<option key={a} value={a}>
										{a}
									</option>
								))}
							</select>
							<button
								onClick={savePrompt}
								disabled={loading}
								className="btn btn-primary"
							>
								Save
							</button>
							{promptSaved && (
								<span style={{ color: "var(--color-pass)", fontSize: "12px" }}>
									Saved
								</span>
							)}
						</div>
					</div>

					{/* Step 3: Re-Evaluate */}
					<div
						className="cycle-step"
						style={{
							background: "var(--color-bg-elevated)",
							borderRadius: "var(--radius-md)",
							padding: "var(--space-md)",
						}}
					>
						<div className="cycle-step-title">Step 3: Re-Evaluate</div>
						<div className="re-eval-comparison">
							<div>
								<div className="re-eval-label">Before</div>
								<div className="re-eval-value">85.0%</div>
							</div>
							<div>
								<div className="re-eval-label">After</div>
								<div className="re-eval-value">91.2%</div>
							</div>
							<div>
								<div className="re-eval-label">Delta</div>
								<div className="re-eval-delta">+6.2%</div>
							</div>
						</div>
						<button className="btn btn-primary" style={{ width: "100%" }}>
							Re-Evaluate -&gt;
						</button>
						<div
							className="quality-gate pass"
							style={{ marginTop: "var(--space-sm)" }}
						>
							<div className="quality-gate-label">Quality Gate</div>
							<div className="quality-gate-status">[PASS]</div>
						</div>
					</div>

					{/* Step 4: Deploy */}
					<div
						className="cycle-step"
						style={{
							background: "var(--color-bg-elevated)",
							borderRadius: "var(--radius-md)",
							padding: "var(--space-md)",
						}}
					>
						<div className="cycle-step-title">Step 4: Deploy</div>
						<div className="cycle-step-content">
							<strong>Version:</strong> v1.3 -&gt; v1.4
							<br />
							<strong>Changes:</strong> Exhibit scanning added
						</div>
						<button
							className="btn btn-success"
							style={{ marginTop: "var(--space-sm)", width: "100%" }}
						>
							Deploy v1.4 -&gt;
						</button>
					</div>
				</div>
			</div>

			{/* Recent Feedback */}
			<div className="card">
				<div className="card-header">Recent Feedback</div>
				{(summary?.recent ?? []).length === 0 ? (
					<p style={{ fontSize: "13px", color: "var(--color-text-disabled)" }}>
						No feedback submitted yet.
					</p>
				) : (
					<div className="feedback-list">
						{summary?.recent.map((fb) => (
							<div key={fb.id} className="feedback-item">
								<StatusBadge
									status={fb.sentiment === "positive" ? "pass" : "fail"}
								/>
								<div style={{ flex: 1 }}>
									<div style={{ fontWeight: 500 }}>
										{fb.agent} - {fb.contract_id}
									</div>
									<div
										style={{
											color: "var(--color-text-tertiary)",
											marginTop: "2px",
										}}
									>
										{fb.comment}
									</div>
									<div
										style={{
											fontSize: "11px",
											color: "var(--color-text-disabled)",
											marginTop: "var(--space-xs)",
										}}
									>
										{fb.reviewer} - {new Date(fb.submitted_at).toLocaleString()}
										{fb.converted_to_test && (
											<span
												style={{
													marginLeft: "var(--space-sm)",
													color: "var(--color-pass)",
												}}
											>
												[converted to test]
											</span>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
