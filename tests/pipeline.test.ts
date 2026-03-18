import { beforeAll, describe, expect, it, vi } from "vitest";
import { getTraces, runPipeline, storeTraces } from "../gateway/src/orchestrator/pipeline.js";
import { initStores } from "../gateway/src/stores/contractStore.js";
import type { ILlmAdapter, LlmRequest, LlmResponse, WebSocketEvent } from "../gateway/src/types.js";

// Simulated adapter that returns canned responses for each pipeline stage
class TestAdapter implements ILlmAdapter {
	async complete(req: LlmRequest): Promise<LlmResponse> {
		const lp = req.prompt.toLowerCase();
		let content: string;

		if (lp.includes("classify") || lp.includes("intake")) {
			content = JSON.stringify({
				type: "NDA",
				confidence: 0.95,
				metadata: { parties: ["A", "B"] },
			});
		} else if (lp.includes("extract") || lp.includes("clause")) {
			content = JSON.stringify({
				clauses: [
					{
						type: "confidentiality",
						text: "Shall not disclose...",
						section: "3",
					},
					{ type: "term", text: "2 years", section: "5" },
				],
			});
		} else if (lp.includes("compliance") || lp.includes("policy")) {
			content = JSON.stringify({
				overallRisk: "low",
				flagsCount: 0,
				results: [],
			});
		} else {
			content = JSON.stringify({
				action: "auto_approve",
				reasoning: "Low risk, no flags",
			});
		}

		return {
			content,
			tokens_in: 100,
			tokens_out: 50,
			latency_ms: 10,
			model: "test",
		};
	}
}

describe("pipeline integration", () => {
	const adapter = new TestAdapter();
	const events: WebSocketEvent[] = [];
	const broadcast = (e: WebSocketEvent) => events.push(e);

	beforeAll(async () => {
		await initStores();
	});

	it("runs full pipeline and returns contract + traces", async () => {
		events.length = 0;
		const result = await runPipeline(
			"This Non-Disclosure Agreement is between Party A and Party B...",
			"nda-test.txt",
			adapter,
			broadcast,
		);

		expect(result.contract).toBeDefined();
		expect(result.contract.id).toMatch(/^contract-/);
		expect(result.traces.length).toBe(6);

		const agents = result.traces.map((t) => t.agent);
		expect(agents).toEqual(["intake", "extraction", "review", "compliance", "negotiation", "approval"]);
	});

	it("accepts a provided contractId", async () => {
		events.length = 0;
		const result = await runPipeline(
			"This NDA is between X and Y...",
			"nda-id.txt",
			adapter,
			broadcast,
			"contract-custom42",
		);

		expect(result.contract.id).toBe("contract-custom42");
	});

	it("broadcasts pipeline events in order", async () => {
		const statusEvents = events
			.filter((e) => e.event === "pipeline_status" || e.event === "agent_step_complete")
			.map((e) => e.status);

		expect(statusEvents[0]).toBe("processing_started");
		expect(statusEvents).toContain("intake_complete");
		expect(statusEvents).toContain("extraction_complete");
		expect(statusEvents).toContain("compliance_complete");
		expect(statusEvents).toContain("pipeline_complete");
	});

	it("stores and retrieves traces", () => {
		storeTraces("test-trace-id", [
			{
				id: "t1",
				contract_id: "test-trace-id",
				agent: "intake",
				tool: "classify_document",
				input: {},
				output: {},
				latency_ms: 10,
				tokens_in: 1,
				tokens_out: 1,
				timestamp: new Date().toISOString(),
			},
		]);
		const traces = getTraces("test-trace-id");
		expect(traces).toHaveLength(1);
		expect(traces[0].agent).toBe("intake");
	});
});
