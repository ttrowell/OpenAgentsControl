/**
 * Auto-Instrumentation Hooks
 * 
 * Wrapper functions that automatically capture observability data:
 * - instrumentedTool: Track tool execution
 * - instrumentedAgent: Track agent execution
 * - instrumentedLLM: Track LLM calls with automatic model detection
 */

import { startActiveObservation, getActiveTraceId } from "@langfuse/tracing";
import { recordInference, getModelSummary, formatCost } from "../collectors/model-collector.js";
import { recordToolCall } from "../collectors/session-collector.js";
import {
  getCurrentModel,
  detectFromHeaders,
  setCurrentModel,
  clearCurrentModel,
  type ModelInfo,
  type LLMResponse,
} from "./model-detector.js";

// Re-export model detection functions
export { getCurrentModel, setCurrentModel, clearCurrentModel, detectFromHeaders } from "./model-detector.js";

// Types
export interface ToolCallResult<T = unknown> {
  result: T;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface LLMCallResult<T = unknown> {
  result: T;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
}

export interface AgentResult<T = unknown> {
  result: T;
  durationMs: number;
  success: boolean;
  toolCount: number;
  error?: string;
}

/**
 * Instrument a tool call with automatic tracing
 */
export async function instrumentedTool<T>(
  name: string,
  args: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<ToolCallResult<T>> {
  const start = Date.now();
  let success = true;
  let errorMessage: string | undefined;

  try {
    const result = await fn();

    // Record in session collector
    await recordToolCall(name, true, Date.now() - start);

    return {
      result,
      durationMs: Date.now() - start,
      success: true,
    };
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);

    // Record failed tool call
    await recordToolCall(name, false, Date.now() - start, { error: errorMessage });

    return {
      result: undefined as T,
      durationMs: Date.now() - start,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Instrument an LLM call with automatic model detection and cost tracking
 * 
 * Detects model from:
 * 1. Response headers (actual model used)
 * 2. Environment variable (CURRENT_MODEL)
 * 3. Config default
 */
export async function instrumentedLLM<T>(
  config: {
    model?: string;
    messages?: Array<{ role: string; content: string }>;
    system?: string;
    [key: string]: unknown;
  },
  fn: (config: Record<string, unknown>) => Promise<{
    content?: Array<{ text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    headers?: Record<string, string>;
    model?: string;
  }>
): Promise<LLMCallResult<T>> {
  const start = Date.now();

  // Get model before call (may be updated after response)
  const preCallModel = getCurrentModel(config.model);

  try {
    const response = await fn({
      ...config,
      model: config.model || preCallModel.model,
    });

    const durationMs = Date.now() - start;

    // Detect actual model from response headers
    let modelInfo: ModelInfo = preCallModel;
    const detectedModel = detectFromHeaders(response.headers || {}, { model: response.model });
    if (detectedModel) {
      modelInfo = {
        model: detectedModel,
        provider: preCallModel.provider, // Keep provider from pre-call
        detectedFrom: "header" as const,
      };
      setCurrentModel(detectedModel); // Update for subsequent calls
    }

    // Extract tokens
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;

    // Calculate cost (imported from model collector)
    const { calculateCost } = await import("../collectors/model-collector.js");
    const cost = calculateCost(modelInfo.model, inputTokens, outputTokens);

    // Record inference
    recordInference({
      model: modelInfo.model,
      provider: modelInfo.provider,
      inputTokens,
      outputTokens,
      latencyMs: durationMs,
      cost,
    });

    // Extract content from response
    const content = response.content?.[0]?.text || "";

    return {
      result: content as T,
      durationMs,
      inputTokens,
      outputTokens,
      cost,
      model: modelInfo.model,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Record failed inference
    recordInference({
      model: preCallModel.model,
      provider: preCallModel.provider,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: durationMs,
      error: errorMessage,
    });

    throw err;
  }
}

/**
 * Instrument an agent execution
 */
export async function instrumentedAgent<T>(
  name: string,
  metadata: Record<string, unknown>,
  fn: (span: { update: (data: Record<string, unknown>) => void }) => Promise<T>
): Promise<AgentResult<T>> {
  const start = Date.now();
  let toolCount = 0;
  let success = true;
  let errorMessage: string | undefined;

  try {
    const result = await startActiveObservation(`agent:${name}`, async (span) => {
      span.update({
        input: metadata,
        metadata: {
          ...metadata,
          startTime: new Date().toISOString(),
          traceId: getActiveTraceId(),
        },
      });

      // Track tool count by wrapping recordToolCall
      const originalRecord = recordToolCall;
      // Note: Can't easily intercept tool calls without modifying session collector
      // This would need integration at the session level

      try {
        const agentResult = await fn({
          update: (data: Record<string, unknown>) => {
            span.update(data);
          },
        });

        span.update({
          output: { success: true },
          metadata: {
            ...metadata,
            endTime: new Date().toISOString(),
            durationMs: Date.now() - start,
          },
        });

        return agentResult;
      } catch (err) {
        span.update({
          output: { success: false, error: err instanceof Error ? err.message : String(err) },
          metadata: {
            ...metadata,
            endTime: new Date().toISOString(),
            durationMs: Date.now() - start,
          },
        });
        throw err;
      }
    });

    return {
      result,
      durationMs: Date.now() - start,
      success: true,
      toolCount,
    };
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);

    return {
      result: undefined as T,
      durationMs: Date.now() - start,
      success: false,
      toolCount,
      error: errorMessage,
    };
  }
}

/**
 * Create a simple span without wrapping a function
 */
export async function createSpan(
  name: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await startActiveObservation(name, async (span) => {
    span.update({
      metadata: metadata || {},
    });
  });
}
