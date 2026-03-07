import type { FastifyInstance } from "fastify";
import { getTraces } from "../orchestrator/pipeline.js";
import { auditStore, contractStore } from "../stores/contractStore.js";

// GPT-4o pricing: $0.005 per 1K input tokens, $0.015 per 1K output tokens
const COST_PER_1K_IN = 0.005;
const COST_PER_1K_OUT = 0.015;

export async function auditRoutes(app: FastifyInstance): Promise<void> {
	// GET /api/v1/audit/:contractId - decision audit trail
	app.get("/api/v1/audit/:contractId", async (request, reply) => {
		const { contractId } = request.params as { contractId: string };
		const entries = auditStore.getByField("contract_id", contractId);
		return reply.send(entries);
	});

	// GET /api/v1/traces/:contractId - trace data
	app.get("/api/v1/traces/:contractId", async (request, reply) => {
		const { contractId } = request.params as { contractId: string };
		const traces = getTraces(contractId);
		return reply.send(traces);
	});

	// GET /api/v1/monitor/:contractId - aggregated cost and token data
	app.get("/api/v1/monitor/:contractId", async (request, reply) => {
		const { contractId } = request.params as { contractId: string };
		const traces = getTraces(contractId);
		const auditEntries = auditStore.getByField("contract_id", contractId);
		const contract = contractStore.getById(contractId);

		const agents = ["intake", "extraction", "compliance", "approval"] as const;
		const agentCosts = agents.map((agent) => {
			const agentTraces = traces.filter((t) => t.agent === agent);
			const tokensIn = agentTraces.reduce((sum, t) => sum + t.tokens_in, 0);
			const tokensOut = agentTraces.reduce((sum, t) => sum + t.tokens_out, 0);
			const latencyMs = agentTraces.reduce((sum, t) => sum + t.latency_ms, 0);
			const cost = (tokensIn / 1000) * COST_PER_1K_IN + (tokensOut / 1000) * COST_PER_1K_OUT;

			return {
				agent,
				tokens_in: tokensIn,
				tokens_out: tokensOut,
				latency_ms: latencyMs,
				cost: Math.round(cost * 10000) / 10000,
			};
		});

		const totalIn = agentCosts.reduce((s, a) => s + a.tokens_in, 0);
		const totalOut = agentCosts.reduce((s, a) => s + a.tokens_out, 0);
		const totalCost = agentCosts.reduce((s, a) => s + a.cost, 0);
		const totalLatency = agentCosts.reduce((s, a) => s + a.latency_ms, 0);

		return reply.send({
			contract_id: contractId,
			status: contract?.status ?? "unknown",
			agents: agentCosts,
			totals: {
				tokens_in: totalIn,
				tokens_out: totalOut,
				cost: Math.round(totalCost * 10000) / 10000,
				latency_ms: totalLatency,
			},
			audit_trail: auditEntries.map((e) => ({
				timestamp: e.timestamp,
				agent: e.agent,
				action: e.action,
				reasoning: e.reasoning,
			})),
			traces_count: traces.length,
		});
	});

	// GET /api/v1/monitor - list all contracts with cost summaries
	app.get("/api/v1/monitor", async (_request, reply) => {
		const contracts = contractStore.getAll();
		const summaries = contracts.map((c) => {
			const traces = getTraces(c.id);
			const totalIn = traces.reduce((s, t) => s + t.tokens_in, 0);
			const totalOut = traces.reduce((s, t) => s + t.tokens_out, 0);
			const totalLatency = traces.reduce((s, t) => s + t.latency_ms, 0);
			const cost = (totalIn / 1000) * COST_PER_1K_IN + (totalOut / 1000) * COST_PER_1K_OUT;

			return {
				contract_id: c.id,
				filename: c.filename,
				status: c.status,
				tokens_in: totalIn,
				tokens_out: totalOut,
				latency_ms: totalLatency,
				cost: Math.round(cost * 10000) / 10000,
				submitted_at: c.submitted_at,
			};
		});

		return reply.send(summaries);
	});
}
