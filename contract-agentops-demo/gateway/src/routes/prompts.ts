import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { appConfig } from "../config.js";

const PROMPTS_DIR = resolve(appConfig.dataDir, "../prompts");

const AGENT_PROMPT_FILES: Record<string, string> = {
	intake: "intake-system.md",
	extraction: "extraction-system.md",
	compliance: "compliance-system.md",
	approval: "approval-system.md",
};

export async function promptRoutes(app: FastifyInstance): Promise<void> {
	// GET /api/v1/prompts/:agent - read system prompt for an agent
	app.get("/api/v1/prompts/:agent", async (request, reply) => {
		const { agent } = request.params as { agent: string };
		const filename = AGENT_PROMPT_FILES[agent];
		if (!filename) {
			return reply.status(404).send({
				error: "NotFound",
				message: `Unknown agent: ${agent}. Valid agents: ${Object.keys(AGENT_PROMPT_FILES).join(", ")}`,
			});
		}

		try {
			const prompt = await readFile(resolve(PROMPTS_DIR, filename), "utf-8");
			return reply.send({ agent, prompt, filename });
		} catch {
			return reply.send({ agent, prompt: "", filename });
		}
	});

	// POST /api/v1/prompts/:agent - update system prompt for an agent
	app.post("/api/v1/prompts/:agent", async (request, reply) => {
		const { agent } = request.params as { agent: string };
		const body = request.body as { prompt?: string } | null;
		const filename = AGENT_PROMPT_FILES[agent];

		if (!filename) {
			return reply.status(404).send({
				error: "NotFound",
				message: `Unknown agent: ${agent}`,
			});
		}

		if (!body?.prompt || typeof body.prompt !== "string") {
			return reply.status(400).send({
				error: "ValidationError",
				message: "prompt field is required",
			});
		}

		await writeFile(resolve(PROMPTS_DIR, filename), body.prompt, "utf-8");
		return reply.send({ agent, saved: true, filename });
	});
}
