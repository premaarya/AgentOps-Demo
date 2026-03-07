import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { extractClauses, extractDatesValues, identifyParties } from "./engine.js";

const PORT = Number.parseInt(process.env.MCP_EXTRACTION_PORT ?? "9002", 10);

const server = new McpServer({
	name: "contract-extraction-mcp",
	version: "1.0.0",
});

server.tool(
	"extract_clauses",
	"Extract key clauses from a contract",
	{
		text: z.string().describe("The contract text to extract clauses from"),
		contract_type: z.string().optional().describe("Type of contract (NDA, MSA, etc.)"),
	},
	async ({ text, contract_type }) => {
		const result = await extractClauses(text, contract_type);
		return {
			content: [{ type: "text" as const, text: JSON.stringify(result) }],
		};
	},
);

server.tool(
	"identify_parties",
	"Identify all parties involved in a contract",
	{
		text: z.string().describe("The contract text to identify parties in"),
	},
	async ({ text }) => {
		const result = await identifyParties(text);
		return {
			content: [{ type: "text" as const, text: JSON.stringify(result) }],
		};
	},
);

server.tool(
	"extract_dates_values",
	"Extract key dates and monetary values from a contract",
	{
		text: z.string().describe("The contract text to extract dates and values from"),
	},
	async ({ text }) => {
		const result = await extractDatesValues(text);
		return {
			content: [{ type: "text" as const, text: JSON.stringify(result) }],
		};
	},
);

const transports = new Map<string, SSEServerTransport>();

const httpServer = createServer(async (req, res) => {
	const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

	if (req.method === "GET" && url.pathname === "/sse") {
		const transport = new SSEServerTransport("/messages", res);
		transports.set(transport.sessionId, transport);
		res.on("close", () => transports.delete(transport.sessionId));
		await server.connect(transport);
	} else if (req.method === "POST" && url.pathname === "/messages") {
		const sessionId = url.searchParams.get("sessionId");
		const transport = sessionId ? transports.get(sessionId) : undefined;
		if (transport) {
			await transport.handlePostMessage(req, res);
		} else {
			res.writeHead(503);
			res.end("Server not connected");
		}
	} else if (req.method === "GET" && url.pathname === "/health") {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "ok", server: "contract-extraction-mcp" }));
	} else {
		res.writeHead(404);
		res.end("Not found");
	}
});

httpServer.listen(PORT, () => {
	console.log(`contract-extraction-mcp listening on port ${PORT}`);
});
