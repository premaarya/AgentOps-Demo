import type { ILlmAdapter, LlmRequest, LlmResponse } from "../types.js";

/**
 * Wraps any ILlmAdapter to track token usage per call.
 * After each agent stage, read lastResponse to get tokens_in/tokens_out.
 */
export class TrackingAdapter implements ILlmAdapter {
	private _lastResponse: LlmResponse | null = null;

	constructor(private readonly inner: ILlmAdapter) {}

	async complete(request: LlmRequest): Promise<LlmResponse> {
		const response = await this.inner.complete(request);
		this._lastResponse = response;
		return response;
	}

	get lastResponse(): LlmResponse | null {
		return this._lastResponse;
	}

	reset(): void {
		this._lastResponse = null;
	}
}
