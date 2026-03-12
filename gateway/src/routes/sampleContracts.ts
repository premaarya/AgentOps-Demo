import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { appConfig } from "../config.js";

const SAMPLES_DIR = resolve(appConfig.dataDir, "sample-contracts");

export async function sampleContractRoutes(app: FastifyInstance): Promise<void> {
	// GET /api/v1/sample-contracts - list available sample contracts
	app.get("/api/v1/sample-contracts", async (_request, reply) => {
		try {
			const files = await readdir(SAMPLES_DIR);
			const contracts = files.filter((f) => f.endsWith(".txt")).map((f) => ({ filename: f }));
			return reply.send(contracts);
		} catch {
			return reply.send([]);
		}
	});

	// GET /api/v1/sample-contracts/:filename - read contract text
	app.get("/api/v1/sample-contracts/:filename", async (request, reply) => {
		const { filename } = request.params as { filename: string };

		// Prevent path traversal
		if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
			return reply.status(400).send({ error: "Invalid filename" });
		}

		try {
			const text = await readFile(resolve(SAMPLES_DIR, filename), "utf-8");
			return reply.send({ filename, text });
		} catch {
			return reply.status(404).send({
				error: "NotFound",
				message: `Sample contract '${filename}' not found`,
			});
		}
	});
}
