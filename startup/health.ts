export interface ChildProcessStatus {
	exitCode: number | null;
	killed?: boolean;
}

export interface WaitForHealthOptions {
	path?: string;
	retries?: number;
	intervalMs?: number;
	requestTimeoutMs?: number;
	process?: ChildProcessStatus;
	logger?: Pick<typeof console, "log" | "warn" | "error">;
	fetchImpl?: typeof fetch;
}

export const defaultWaitForHealthOptions = {
	path: "/health",
	retries: 30,
	intervalMs: 1000,
	requestTimeoutMs: 2000,
} satisfies Required<Pick<WaitForHealthOptions, "path" | "retries" | "intervalMs" | "requestTimeoutMs">>;

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForHealth(port: number, label: string, options: WaitForHealthOptions = {}): Promise<boolean> {
	const {
		path = defaultWaitForHealthOptions.path,
		retries = defaultWaitForHealthOptions.retries,
		intervalMs = defaultWaitForHealthOptions.intervalMs,
		requestTimeoutMs = defaultWaitForHealthOptions.requestTimeoutMs,
		process,
		logger = console,
		fetchImpl = fetch,
	} = options;

	for (let attempt = 1; attempt <= retries; attempt++) {
		if (process && (process.killed || process.exitCode !== null)) {
			logger.error(`[${label}] exited before becoming healthy`);
			return false;
		}

		try {
			const response = await fetchImpl(`http://localhost:${port}${path}`, {
				signal: AbortSignal.timeout(requestTimeoutMs),
			});
			if (response.ok) {
				logger.log(`[${label}] healthy on port ${port}`);
				return true;
			}
		} catch {
			// Startup polling intentionally ignores transient connection errors.
		}

		if (attempt < retries) {
			await delay(intervalMs);
		}
	}

	logger.warn(`[${label}] not healthy after ${retries} retries`);
	return false;
}
