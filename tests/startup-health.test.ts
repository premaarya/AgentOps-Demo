import { describe, expect, it, vi } from "vitest";
import { waitForHealth } from "../startup/health.js";

describe("startup health checks", () => {
	it("retries until the service becomes healthy", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockRejectedValueOnce(new Error("booting"))
			.mockResolvedValueOnce({ ok: true } as Response);

		const result = await waitForHealth(9999, "test-service", {
			retries: 3,
			intervalMs: 1,
			requestTimeoutMs: 10,
			fetchImpl: fetchMock,
			logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
		});

		expect(result).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("fails early when the child process exits before health is reachable", async () => {
		const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
		const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };

		const result = await waitForHealth(9999, "test-service", {
			retries: 5,
			intervalMs: 1,
			requestTimeoutMs: 10,
			process: { exitCode: 1 },
			fetchImpl: fetchMock,
			logger,
		});

		expect(result).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith("[test-service] exited before becoming healthy");
	});

	it("returns false after exhausting retries", async () => {
		const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
		const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };

		const result = await waitForHealth(9999, "test-service", {
			retries: 3,
			intervalMs: 1,
			requestTimeoutMs: 10,
			fetchImpl: fetchMock,
			logger,
		});

		expect(result).toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(logger.warn).toHaveBeenCalledWith("[test-service] not healthy after 3 retries");
	});
});