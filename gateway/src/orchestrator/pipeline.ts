import { randomUUID } from "node:crypto";
import type {
  Contract,
  AuditEntry,
  TraceEntry,
  WebSocketEvent,
  ILlmAdapter,
} from "../types.js";
import { contractStore, auditStore } from "../stores/contractStore.js";
import { runIntakeAgent } from "../../../agents/src/intakeAgent.js";
import { runExtractionAgent } from "../../../agents/src/extractionAgent.js";
import { runComplianceAgent } from "../../../agents/src/complianceAgent.js";
import { runApprovalAgent } from "../../../agents/src/approvalAgent.js";

export type WsBroadcast = (event: WebSocketEvent) => void;

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

class PipelineError extends Error {
  constructor(
    public stage: string,
    public agent: string,
    public originalError: Error,
    public contractId: string,
  ) {
    super(`Pipeline failed at ${stage} (${agent}): ${originalError.message}`);
    this.name = "PipelineError";
  }
}

async function withRetry<T>(
  operation: () => Promise<T>,
  stage: string,
  agent: string,
  contractId: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt),
          config.maxDelayMs
        );
        
        await logAudit(contractId, agent as AuditEntry["agent"], "error", 
          `Attempt ${attempt + 1}/${config.maxRetries + 1} failed: ${lastError.message}. Retrying in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new PipelineError(stage, agent, lastError!, contractId);
}

export interface PipelineResult {
  contract: Contract;
  traces: TraceEntry[];
}

export async function runPipeline(
  contractText: string,
  filename: string,
  adapter: ILlmAdapter,
  broadcast: WsBroadcast,
): Promise<PipelineResult> {
  const contractId = `contract-${randomUUID().slice(0, 8)}`;
  const traceId = `trace-${randomUUID().slice(0, 8)}`;
  const traces: TraceEntry[] = [];

  const contract: Contract = {
    id: contractId,
    filename,
    text: contractText,
    status: "processing",
    submitted_at: new Date().toISOString(),
  };
  await contractStore.add(contract);

  try {
    broadcast({
      event: "pipeline_status",
      contract_id: contractId,
      status: "processing_started",
      timestamp: new Date().toISOString(),
    });

    // Stage 1: Intake with retry logic
    const intakeStart = Date.now();
    const intakeResult = await withRetry(
      () => runIntakeAgent(adapter, contractText, contractId, traceId),
      "intake",
      "intake",
      contractId,
    );
    const intakeLatency = Date.now() - intakeStart;

    // Validate intake result
    if (!intakeResult?.type || intakeResult.confidence < 0.3) {
      throw new Error(`Invalid intake result: type=${intakeResult?.type}, confidence=${intakeResult?.confidence}`);
    }

    traces.push({
      id: randomUUID(),
      contract_id: contractId,
      agent: "intake",
      tool: "classify_document",
      input: { text: contractText.slice(0, 200) },
      output: intakeResult,
      latency_ms: intakeLatency,
      tokens_in: 0,
      tokens_out: 0,
      timestamp: new Date().toISOString(),
    });

    await contractStore.update(contractId, {
      type: intakeResult.type as Contract["type"],
      classification_confidence: intakeResult.confidence,
    });

    await logAudit(contractId, "intake", "classified", `Classified as ${intakeResult.type} with ${intakeResult.confidence} confidence`);

    broadcast({
      event: "agent_step_complete",
      contract_id: contractId,
      agent: "intake",
      status: "intake_complete",
      result: intakeResult,
      latency_ms: intakeLatency,
      timestamp: new Date().toISOString(),
    });

    // Stage 2: Extraction with retry logic
    const extractStart = Date.now();
    const extractResult = await withRetry(
      () => runExtractionAgent(adapter, contractText, contractId, traceId),
      "extraction", 
      "extraction",
      contractId,
    );
    const extractLatency = Date.now() - extractStart;

    // Validate extraction result
    if (!extractResult?.clauses || extractResult.clauses.length === 0) {
      throw new Error(`Invalid extraction result: no clauses extracted`);
    }

    traces.push({
      id: randomUUID(),
      contract_id: contractId,
      agent: "extraction",
      tool: "extract_clauses",
      input: { text: contractText.slice(0, 200) },
      output: extractResult,
      latency_ms: extractLatency,
      tokens_in: 0,
      tokens_out: 0,
      timestamp: new Date().toISOString(),
    });

    await logAudit(contractId, "extraction", "extracted", `Extracted ${extractResult.clauses.length} clauses`);

    broadcast({
      event: "agent_step_complete",
      contract_id: contractId,
      agent: "extraction",
      status: "extraction_complete",
      result: extractResult,
      latency_ms: extractLatency,
      timestamp: new Date().toISOString(),
    });

    // Stage 3: Compliance with retry logic
    const complianceStart = Date.now();
    const complianceResult = await withRetry(
      () => runComplianceAgent(adapter, extractResult.clauses, contractId, traceId),
      "compliance",
      "compliance", 
      contractId,
    );
    const complianceLatency = Date.now() - complianceStart;

    // Validate compliance result
    if (!complianceResult?.overallRisk) {
      throw new Error(`Invalid compliance result: missing overall risk assessment`);
    }

    traces.push({
      id: randomUUID(),
      contract_id: contractId,
      agent: "compliance",
      tool: "check_policy",
      input: { clauses_count: extractResult.clauses.length },
      output: complianceResult,
      latency_ms: complianceLatency,
      tokens_in: 0,
      tokens_out: 0,
      timestamp: new Date().toISOString(),
    });

    await logAudit(contractId, "compliance", "flagged", `Risk: ${complianceResult.overallRisk}, Flags: ${complianceResult.flagsCount}`);

    broadcast({
      event: "agent_step_complete",
      contract_id: contractId,
      agent: "compliance",
      status: "compliance_complete",
      result: complianceResult,
      latency_ms: complianceLatency,
      timestamp: new Date().toISOString(),
    });

    // Stage 4: Approval with retry logic
    const approvalStart = Date.now();
    const approvalResult = await withRetry(
      () => runApprovalAgent(
        adapter,
        complianceResult.overallRisk,
        complianceResult.flagsCount,
        contractId,
        traceId,
      ),
      "approval",
      "approval",
      contractId,
    );
    const approvalLatency = Date.now() - approvalStart;

    // Validate approval result
    if (!approvalResult?.action || !["auto_approve", "escalate_to_human"].includes(approvalResult.action)) {
      throw new Error(`Invalid approval result: action=${approvalResult?.action}`);
    }

    traces.push({
      id: randomUUID(),
      contract_id: contractId,
      agent: "approval",
      tool: "route_approval",
      input: { risk: complianceResult.overallRisk, flags: complianceResult.flagsCount },
      output: approvalResult,
      latency_ms: approvalLatency,
      tokens_in: 0,
      tokens_out: 0,
      timestamp: new Date().toISOString(),
    });

    const finalStatus = approvalResult.action === "auto_approve" ? "approved" : "awaiting_review";
    const auditAction = approvalResult.action === "auto_approve" ? "approved" : "escalated";

    await contractStore.update(contractId, {
      status: finalStatus,
      completed_at: finalStatus === "approved" ? new Date().toISOString() : undefined,
    });

    await logAudit(contractId, "approval", auditAction as AuditEntry["action"], approvalResult.reasoning);

    const finalEvent: PipelineStageForBroadcast = finalStatus === "approved" ? "approved" : "awaiting_human_review";

    broadcast({
      event: "agent_step_complete",
      contract_id: contractId,
      agent: "approval",
      status: finalEvent,
      result: approvalResult,
      latency_ms: approvalLatency,
      timestamp: new Date().toISOString(),
    });

    broadcast({
      event: "pipeline_status",
      contract_id: contractId,
      status: "pipeline_complete",
      timestamp: new Date().toISOString(),
    });

    const updatedContract = await contractStore.getById(contractId);
    return { contract: updatedContract ?? contract, traces };

  } catch (error) {
    // Handle pipeline failure
    const pipelineError = error instanceof PipelineError ? error : 
      new PipelineError("unknown", "pipeline", error instanceof Error ? error : new Error(String(error)), contractId);

    await contractStore.update(contractId, {
      status: "failed",
      error_message: pipelineError.message,
      completed_at: new Date().toISOString(),
    });

    await logAudit(contractId, pipelineError.agent as AuditEntry["agent"], "error", pipelineError.message);

    broadcast({
      event: "pipeline_status",
      contract_id: contractId,
      status: "pipeline_failed",
      timestamp: new Date().toISOString(),
    });

    throw pipelineError;
  }
}

type PipelineStageForBroadcast = WebSocketEvent["status"];

async function logAudit(contractId: string, agent: AuditEntry["agent"], action: AuditEntry["action"], description: string) {
  const audit: AuditEntry = {
    id: randomUUID(),
    contract_id: contractId,
    agent,
    action,
    reasoning: description,
    timestamp: new Date().toISOString(),
  };
  await auditStore.add(audit);
}

// --- In-memory trace storage (bounded to prevent memory leaks) ---
const MAX_TRACE_ENTRIES = 500;
const traceMap = new Map<string, TraceEntry[]>();

export function storeTraces(contractId: string, traces: TraceEntry[]): void {
  // Evict oldest entry if at capacity
  if (traceMap.size >= MAX_TRACE_ENTRIES && !traceMap.has(contractId)) {
    const oldest = traceMap.keys().next().value;
    if (oldest !== undefined) {
      traceMap.delete(oldest);
    }
  }
  traceMap.set(contractId, traces);
}

export function getTraces(contractId: string): TraceEntry[] {
  return traceMap.get(contractId) ?? [];
}
