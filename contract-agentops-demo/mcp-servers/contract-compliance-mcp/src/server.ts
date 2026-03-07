import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "node:http";
import { z } from "zod";
import { checkPolicy, flagRisk, getPolicyRules, addPolicyRule, updatePolicyRule, deletePolicyRule } from "./engine.js";
import { PolicyRule } from "./policyEngine.js";

const PORT = parseInt(process.env["MCP_COMPLIANCE_PORT"] ?? "9003", 10);

const server = new McpServer({
  name: "contract-compliance-mcp",
  version: "1.0.0",
});

server.tool(
  "check_policy",
  "Check extracted clauses against company policies",
  {
    clauses: z.string().describe("JSON array of extracted clauses"),
    contract_type: z.string().optional().describe("Type of contract"),
  },
  async ({ clauses, contract_type }) => {
    const parsedClauses = JSON.parse(clauses) as Array<{
      type: string;
      text: string;
      section: string;
    }>;
    const result = await checkPolicy(parsedClauses, contract_type);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "flag_risk",
  "Assess overall risk level based on compliance results",
  {
    clause_results: z.string().describe("JSON array of clause compliance results"),
  },
  async ({ clause_results }) => {
    const parsed = JSON.parse(clause_results) as Array<{
      clause_type: string;
      status: string;
      policy_ref: string;
      reason: string;
    }>;
    const result = await flagRisk(parsed);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "get_policy_rules",
  "Retrieve company policy rules for compliance checking",
  {},
  async () => {
    const rules = await getPolicyRules();
    return { content: [{ type: "text" as const, text: JSON.stringify(rules) }] };
  },
);

server.tool(
  "add_policy_rule",
  "Add a new dynamic policy rule",
  {
    rule: z.string().describe("JSON object containing the policy rule definition"),
  },
  async ({ rule }) => {
    const parsedRule = JSON.parse(rule) as PolicyRule;
    await addPolicyRule(parsedRule);
    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: "Policy rule added successfully" }) }] };
  },
);

server.tool(
  "update_policy_rule",
  "Update an existing policy rule",
  {
    rule_id: z.string().describe("ID of the policy rule to update"),
    updates: z.string().describe("JSON object containing the fields to update"),
  },
  async ({ rule_id, updates }) => {
    const parsedUpdates = JSON.parse(updates) as Partial<PolicyRule>;
    const success = await updatePolicyRule(rule_id, parsedUpdates);
    return { content: [{ type: "text" as const, text: JSON.stringify({ success, message: success ? "Policy rule updated successfully" : "Policy rule not found" }) }] };
  },
);

server.tool(
  "delete_policy_rule",
  "Delete a policy rule",
  {
    rule_id: z.string().describe("ID of the policy rule to delete"),
  },
  async ({ rule_id }) => {
    const success = await deletePolicyRule(rule_id);
    return { content: [{ type: "text" as const, text: JSON.stringify({ success, message: success ? "Policy rule deleted successfully" : "Policy rule not found" }) }] };
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
    res.end(JSON.stringify({ status: "ok", server: "contract-compliance-mcp" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(PORT, () => {
  console.log(`contract-compliance-mcp listening on port ${PORT}`);
});
