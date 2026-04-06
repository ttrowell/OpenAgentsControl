/**
 * Auto-Instrumentation Hooks
 * 
 * Wrapper functions that automatically capture observability data:
 * - instrumentedTool: Track tool execution
 * - instrumentedAgent: Track agent execution
 * - instrumentedLLM: Track LLM calls with automatic model detection
 * 
 * All hooks capture rich context including:
 * - Agent info (name, type, version)
 * - Task info (goal, taskId)
 * - Build info (git hash, branch)
 * - Error stack traces
 */

import { startActiveObservation, getActiveTraceId } from "@langfuse/tracing";
import { recordInference } from "../collectors/model-collector.js";
import { recordToolCall, getTraceContext, getCurrentSession } from "../collectors/session-collector.js";
import { captureError } from "../trace-context.js";
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
 * 
 * Captures:
 * - Tool name and arguments
 * - Execution time
 * - Success/failure with error stack trace
 * - Agent, task, and build context
 */
export async function instrumentedTool<T>(
  name: string,
  args: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<ToolCallResult<T>> {
  const start = Date.now();
  const traceCtx = getTraceContext();
  const sessionCtx = getCurrentSession();

  try {
    const result = await fn();

    // Record in session collector
    await recordToolCall(name, true, Date.now() - start, {
      toolArgs: args,
      agentName: sessionCtx?.agentName,
      agentType: sessionCtx?.agentType,
      taskId: sessionCtx?.task?.taskId,
      gitHash: traceCtx?.build.gitHash,
    });

    return {
      result,
      durationMs: Date.now() - start,
      success: true,
    };
  } catch (err) {
    const errCtx = captureError(err);

    // Record failed tool call with enhanced error details
    await recordToolCall(name, false, Date.now() - start, {
      toolArgs: args,
      agentName: sessionCtx?.agentName,
      agentType: sessionCtx?.agentType,
      taskId: sessionCtx?.task?.taskId,
      gitHash: traceCtx?.build.gitHash,
      // Enhanced error details
      errorMessage: errCtx.message,
      errorStack: errCtx.stack,
      errorName: errCtx.name,
    });

    return {
      result: undefined as T,
      durationMs: Date.now() - start,
      success: false,
      error: errCtx.message,
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
 * 
 * Captures:
 * - Model info (name, provider)
 * - Token usage
 * - Latency and cost
 * - Agent, task, and build context
 * - Error stack traces on failure
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
  const traceCtx = getTraceContext();
  const sessionCtx = getCurrentSession();

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

    // Record inference with enhanced context
    recordInference({
      model: modelInfo.model,
      provider: modelInfo.provider,
      inputTokens,
      outputTokens,
      latencyMs: durationMs,
      cost,
      // Enhanced metadata
      metadata: {
        agentName: sessionCtx?.agentName,
        agentType: sessionCtx?.agentType,
        taskId: sessionCtx?.task?.taskId,
        taskGoal: sessionCtx?.task?.goal?.slice(0, 200),
        gitHash: traceCtx?.build.gitHash,
        gitBranch: traceCtx?.build.gitBranch,
        buildVersion: traceCtx?.build.version,
        detectedFrom: modelInfo.detectedFrom,
      },
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
    const errCtx = captureError(err);
    const durationMs = Date.now() - start;

    // Record failed inference with enhanced error details
    recordInference({
      model: preCallModel.model,
      provider: preCallModel.provider,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: durationMs,
      error: errCtx.message,
      metadata: {
        agentName: sessionCtx?.agentName,
        agentType: sessionCtx?.agentType,
        taskId: sessionCtx?.task?.taskId,
        gitHash: traceCtx?.build.gitHash,
        // Enhanced error details
        errorStack: errCtx.stack,
        errorName: errCtx.name,
      },
    });

    throw err;
  }
}

/**
 * Instrument an agent execution
 * 
 * Captures:
 * - Agent name and task metadata
 * - Execution time
 * - Success/failure with error stack trace
 * - Agent, task, and build context
 * - Full span update capability for custom metadata
 */
export async function instrumentedAgent<T>(
  name: string,
  metadata: Record<string, unknown>,
  fn: (span: { update: (data: Record<string, unknown>) => void }) => Promise<T>
): Promise<AgentResult<T>> {
  const start = Date.now();
  const traceCtx = getTraceContext();
  const sessionCtx = getCurrentSession();
  let toolCount = 0;
  let success = true;
  let errorMessage: string | undefined;

  // Build enhanced metadata with context
  const buildSpanMetadata = (extra?: Record<string, unknown>) => ({
    ...metadata,
    // Agent context
    agentName: sessionCtx?.agentName || metadata.agentName,
    agentType: sessionCtx?.agentType || metadata.agentType,
    agentVersion: traceCtx?.build.version,
    // Task context
    taskId: sessionCtx?.task?.taskId || metadata.taskId,
    taskGoal: sessionCtx?.task?.goal || metadata.taskGoal,
    // Build context
    gitHash: traceCtx?.build.gitHash,
    gitBranch: traceCtx?.build.gitBranch,
    buildVersion: traceCtx?.build.version,
    // System context
    hostname: traceCtx?.system.hostname,
    platform: traceCtx?.system.platform,
    nodeVersion: traceCtx?.system.nodeVersion,
    cwd: traceCtx?.system.cwd,
    // Timing
    startTime: new Date().toISOString(),
    traceId: getActiveTraceId(),
    ...extra,
  });

  try {
    const result = await startActiveObservation(`agent:${name}`, async (span) => {
      span.update({
        input: metadata,
        metadata: buildSpanMetadata(),
      });

      try {
        const agentResult = await fn({
          update: (data: Record<string, unknown>) => {
            span.update(data);
          },
        });

        span.update({
          output: { success: true },
          metadata: buildSpanMetadata({
            endTime: new Date().toISOString(),
            durationMs: Date.now() - start,
          }),
        });

        return agentResult;
      } catch (err) {
        const errCtx = captureError(err);
        span.update({
          output: { success: false, error: errCtx.message },
          metadata: buildSpanMetadata({
            endTime: new Date().toISOString(),
            durationMs: Date.now() - start,
            // Enhanced error details
            errorMessage: errCtx.message,
            errorStack: errCtx.stack,
            errorName: errCtx.name,
          }),
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
    const errCtx = captureError(err);
    success = false;
    errorMessage = errCtx.message;

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
 * 
 * Automatically includes trace context if available.
 */
export async function createSpan(
  name: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const traceCtx = getTraceContext();
  const sessionCtx = getCurrentSession();

  await startActiveObservation(name, async (span) => {
    span.update({
      metadata: {
        // Include context if available
        ...(traceCtx && {
          gitHash: traceCtx.build.gitHash,
          gitBranch: traceCtx.build.gitBranch,
          buildVersion: traceCtx.build.version,
          hostname: traceCtx.system.hostname,
        }),
        ...(sessionCtx && {
          agentName: sessionCtx.agentName,
          agentType: sessionCtx.agentType,
          taskId: sessionCtx.task?.taskId,
        }),
        // User-provided metadata
        ...(metadata || {}),
      },
    });
  });
}
