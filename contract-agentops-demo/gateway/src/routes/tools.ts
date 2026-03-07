import type { FastifyInstance } from "fastify";
import { MCP_SERVERS } from "../config.js";
import type { McpServerInfo } from "../types.js";

/** Known tools per MCP server – derived from actual server.tool() registrations. */
const TOOL_REGISTRY: Record<string, Array<{ name: string; description: string }>> = {
	"contract-intake-mcp": [
		{
			name: "upload_contract",
			description: "Upload and register a new contract",
		},
		{
			name: "classify_document",
			description: "Classify the type of contract document",
		},
		{
			name: "extract_metadata",
			description: "Extract metadata from a contract",
		},
	],
	"contract-extraction-mcp": [
		{
			name: "extract_clauses",
			description: "Extract key clauses from a contract",
		},
		{
			name: "identify_parties",
			description: "Identify all parties involved in a contract",
		},
		{
			name: "extract_dates_values",
			description: "Extract key dates and monetary values",
		},
	],
	"contract-compliance-mcp": [
		{
			name: "check_policy",
			description: "Check clauses against compliance policies",
		},
		{ name: "flag_risk", description: "Flag risky clauses that need review" },
		{
			name: "get_policy_rules",
			description: "Get all active compliance policy rules",
		},
		{ name: "add_policy_rule", description: "Add a new policy rule" },
		{
			name: "update_policy_rule",
			description: "Update an existing policy rule",
		},
		{ name: "delete_policy_rule", description: "Delete a policy rule" },
	],
	"contract-workflow-mcp": [
		{
			name: "route_approval",
			description: "Route contract for approval based on risk",
		},
		{
			name: "escalate_to_human",
			description: "Escalate contract for human review",
		},
		{
			name: "notify_stakeholder",
			description: "Notify a stakeholder about a contract",
		},
	],
	"contract-audit-mcp": [
		{ name: "log_decision", description: "Log a decision to the audit trail" },
		{ name: "get_audit_trail", description: "Get audit trail for a contract" },
		{ name: "generate_report", description: "Generate an audit report" },
	],
	"contract-eval-mcp": [
		{
			name: "run_evaluation",
			description: "Run evaluation suite for an agent",
		},
		{ name: "get_results", description: "Get evaluation results" },
		{
			name: "compare_baseline",
			description: "Compare results against a baseline",
		},
	],
	"contract-drift-mcp": [
		{ name: "detect_llm_drift", description: "Detect LLM output drift" },
		{
			name: "detect_data_drift",
			description: "Detect data distribution drift",
		},
		{ name: "simulate_model_swap", description: "Simulate swapping the model" },
	],
	"contract-feedback-mcp": [
		{ name: "submit_feedback", description: "Submit feedback for an agent" },
		{
			name: "convert_to_tests",
			description: "Convert negative feedback to test cases",
		},
		{ name: "get_summary", description: "Get feedback summary" },
	],
};

/**
 * Establish an SSE session with an MCP server and invoke a tool via JSON-RPC.
 * The MCP SDK requires: GET /sse to get a sessionId, then POST /messages?sessionId=xxx.
 */
async function callMcpTool(
	port: number,
	tool: string,
	input: Record<string, unknown>,
): Promise<{ result: unknown; error?: string }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15_000);

	try {
		// Step 1: Open SSE connection and extract sessionId from the endpoint event
		const sseRes = await fetch(`http://localhost:${port}/sse`, {
			signal: controller.signal,
		});

		if (!sseRes.ok || !sseRes.body) {
			return {
				result: null,
				error: `SSE connection failed (${sseRes.status})`,
			};
		}

		// Read the SSE stream to get the endpoint event with sessionId
		const reader = sseRes.body.getReader();
		const decoder = new TextDecoder();
		let sessionId = "";
		let buffer = "";

		// Read until we get the endpoint event
		while (!sessionId) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			// Parse SSE events from buffer
			const lines = buffer.split("\n");
			for (let i = 0; i < lines.length - 1; i++) {
				const line = lines[i];
				if (line.startsWith("data: ")) {
					const data = line.slice(6).trim();
					// The endpoint event data contains the URL with sessionId
					const match = data.match(/sessionId=([a-zA-Z0-9_-]+)/);
					if (match) {
						sessionId = match[1];
						break;
					}
				}
			}
		}

		if (!sessionId) {
			reader.cancel().catch(() => {});
			return { result: null, error: "Failed to get sessionId from SSE" };
		}

		// Step 2: Send JSON-RPC tool call via POST
		const rpcRes = await fetch(`http://localhost:${port}/messages?sessionId=${encodeURIComponent(sessionId)}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: { name: tool, arguments: input },
			}),
			signal: AbortSignal.timeout(10_000),
		});

		if (!rpcRes.ok) {
			const errText = await rpcRes.text();
			reader.cancel().catch(() => {});
			return {
				result: null,
				error: `RPC failed (${rpcRes.status}): ${errText}`,
			};
		}

		// Step 3: Read SSE stream for the response
		let responseBuffer = buffer; // carry over any buffered data

		interface JsonRpcResult {
			result?: { content?: Array<{ text?: string }> };
			error?: { message: string };
		}

		let jsonRpcResponse: JsonRpcResult | null = null;

		const readTimeout = setTimeout(() => {
			reader.cancel().catch(() => {});
		}, 10_000);

		while (!jsonRpcResponse) {
			const { done, value } = await reader.read();
			if (done) break;
			responseBuffer += decoder.decode(value, { stream: true });

			const eventLines = responseBuffer.split("\n");
			for (let i = 0; i < eventLines.length - 1; i++) {
				const eventLine = eventLines[i];
				if (eventLine.startsWith("data: ")) {
					const eventData = eventLine.slice(6).trim();
					try {
						const parsed = JSON.parse(eventData) as Record<string, unknown>;
						if (parsed.id === 1 && (parsed.result !== undefined || parsed.error !== undefined)) {
							jsonRpcResponse = parsed as JsonRpcResult;
							break;
						}
					} catch {
						// not JSON, skip
					}
				}
			}
		}

		clearTimeout(readTimeout);
		reader.cancel().catch(() => {});

		if (!jsonRpcResponse) {
			return { result: null, error: "No response from MCP server" };
		}

		if (jsonRpcResponse.error) {
			return { result: null, error: jsonRpcResponse.error.message };
		}

		const outputText = jsonRpcResponse.result?.content?.[0]?.text ?? "{}";
		try {
			return { result: JSON.parse(outputText) };
		} catch {
			return { result: outputText };
		}
	} finally {
		clearTimeout(timeout);
	}
}

export async function toolRoutes(app: FastifyInstance): Promise<void> {
	// GET /api/v1/tools - list all MCP servers and their tools
	app.get("/api/v1/tools", async (_request, reply) => {
		const servers: McpServerInfo[] = [];

		for (const server of MCP_SERVERS) {
			let status: "online" | "offline" = "offline";
			try {
				const healthRes = await fetch(`http://localhost:${server.port}/health`, {
					signal: AbortSignal.timeout(3000),
				});
				if (healthRes.ok) status = "online";
			} catch {
				// server offline
			}

			const knownTools = TOOL_REGISTRY[server.name] ?? [];
			servers.push({
				name: server.name,
				port: server.port,
				tools: knownTools.map((t) => ({
					name: t.name,
					description: t.description,
					inputSchema: {},
				})),
				status,
			});
		}

		return reply.send(servers);
	});

	// POST /api/v1/tools/:server/:tool - execute a single MCP tool
	app.post("/api/v1/tools/:server/:tool", async (request, reply) => {
		const { server, tool } = request.params as { server: string; tool: string };
		const body = request.body as { input?: Record<string, unknown> } | null;

		const mcpServer = MCP_SERVERS.find((s) => s.name === server);
		if (!mcpServer) {
			return reply.status(404).send({
				error: "NotFound",
				message: `MCP server '${server}' not found`,
			});
		}

		const startTime = Date.now();

		try {
			const { result, error } = await callMcpTool(mcpServer.port, tool, body?.input ?? {});

			if (error) {
				return reply.status(500).send({
					error: "ToolError",
					message: error,
					latency_ms: Date.now() - startTime,
				});
			}

			return reply.send({
				output: result,
				latency_ms: Date.now() - startTime,
				status: "success",
			});
		} catch (err) {
			return reply.status(503).send({
				error: "ServiceUnavailable",
				message: `MCP server '${server}' is not responding`,
				latency_ms: Date.now() - startTime,
			});
		}
	});
}
