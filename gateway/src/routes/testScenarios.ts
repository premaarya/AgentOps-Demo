import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { appConfig } from "../config.js";

const SCENARIOS_PATH = resolve(appConfig.dataDir, "test-scenarios.json");

export interface TestScenario {
	id: string;
	name: string;
	description: string;
	inputSummary: string;
	expectations: string[];
	requiredCapabilities: string[];
	requiresHumanReview: boolean;
	prefersParallel: boolean;
}

async function loadScenarios(): Promise<TestScenario[]> {
	try {
		const raw = await readFile(SCENARIOS_PATH, "utf-8");
		return JSON.parse(raw);
	} catch {
		return [];
	}
}

async function saveScenarios(scenarios: TestScenario[]): Promise<void> {
	await writeFile(SCENARIOS_PATH, JSON.stringify(scenarios, null, 2));
}

export async function testScenarioRoutes(app: FastifyInstance): Promise<void> {
	// GET /api/v1/test-scenarios - list all test scenarios
	app.get("/api/v1/test-scenarios", async (_request, reply) => {
		const scenarios = await loadScenarios();
		return reply.send(scenarios);
	});

	// POST /api/v1/test-scenarios - add a new test scenario
	app.post("/api/v1/test-scenarios", async (request, reply) => {
		const body = request.body as Partial<TestScenario> | null;

		if (!body?.id || !body?.name || !body?.description) {
			return reply.status(400).send({
				error: "ValidationError",
				message: "Fields id, name, and description are required",
			});
		}

		const scenarios = await loadScenarios();
		if (scenarios.some((s) => s.id === body.id)) {
			return reply.status(409).send({
				error: "ConflictError",
				message: `Scenario with id '${body.id}' already exists`,
			});
		}

		const scenario: TestScenario = {
			id: body.id,
			name: body.name,
			description: body.description,
			inputSummary: body.inputSummary ?? "",
			expectations: body.expectations ?? [],
			requiredCapabilities: body.requiredCapabilities ?? [],
			requiresHumanReview: body.requiresHumanReview ?? false,
			prefersParallel: body.prefersParallel ?? false,
		};

		scenarios.push(scenario);
		await saveScenarios(scenarios);
		return reply.status(201).send(scenario);
	});

	// DELETE /api/v1/test-scenarios/:id - remove a test scenario
	app.delete("/api/v1/test-scenarios/:id", async (request, reply) => {
		const { id } = request.params as { id: string };
		const scenarios = await loadScenarios();
		const filtered = scenarios.filter((s) => s.id !== id);

		if (filtered.length === scenarios.length) {
			return reply.status(404).send({
				error: "NotFound",
				message: `Scenario '${id}' not found`,
			});
		}

		await saveScenarios(filtered);
		return reply.send({ message: `Scenario '${id}' deleted` });
	});
}
