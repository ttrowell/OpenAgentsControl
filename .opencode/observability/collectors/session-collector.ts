/**
 * SessionCollector - Links Langfuse traces to OAC sessions
 * 
 * This collector provides session-level observability by:
 * - Creating traces with session context (sessionId, userId)
 * - Tracking session lifecycle events
 * - Linking session metrics to traces
 * 
 * IMPORTANT: Uses Langfuse's sessionId field for proper session linking
 * @see https://langfuse.com/docs/observability/features/sessions
 */

import { startActiveObservation, propagateAttributes } from "@langfuse/tracing";
import * as os from "node:os";

// Types
export interface SessionContext {
  sessionId: string;
  userId?: string;
  agentName?: string;
  projectPath?: string;
}

export interface SessionMetrics {
  sessionId: string;
  durationMs: number;
  toolCount: number;
  messageCount: number;
  successRate: number;
  errors: string[];
}

export interface SessionCollectorOptions {
  baseUrl?: string;
  enabled?: boolean;
}

// State
let currentSession: SessionContext | null = null;
let sessionStartTime: number | null = null;
let toolCount = 0;
let errorCount = 0;

// Pure helper functions
const getHostname = (): string => os.hostname();

const getUsername = (): string => os.userInfo().username;

const formatTimestamp = (date: Date = new Date()): string => date.toISOString();

/**
 * Start a new session observation
 * 
 * This creates a trace with the sessionId properly linked in Langfuse.
 * Uses propagateAttributes to create the session and link traces.
 * 
 * @see https://langfuse.com/docs/observability/features/sessions
 */
export async function startSession(context: SessionContext): Promise<void> {
  currentSession = context;
  sessionStartTime = Date.now();
  toolCount = 0;
  errorCount = 0;

  // Create session within propagated context
  // This ensures the session is created and traces are linked
  await propagateAttributes({
    sessionId: context.sessionId,
    userId: context.userId || getUsername(),
    metadata: {
      agentName: context.agentName || "",
      projectPath: context.projectPath || "",
      hostname: getHostname(),
    },
    tags: ["oac-session"],
  }, async () => {
    // Create the initial span within the propagated context
    // This span will have sessionId/userId set via context propagation
    await startActiveObservation("session:start", async (span) => {
      span.update({
        input: { action: "session_start", sessionId: context.sessionId },
        metadata: {
          startTime: formatTimestamp(),
          agentName: context.agentName || "",
          projectPath: context.projectPath || "",
          hostname: getHostname(),
        },
      });
    });
  });
}

/**
 * Record a tool call within the current session
 */
export async function recordToolCall(
  toolName: string,
  success: boolean,
  latencyMs?: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  toolCount++;

  if (!success) {
    errorCount++;
  }

  await startActiveObservation("session:tool", async (span) => {
    span.update({
      input: { tool: toolName, sessionId: currentSession?.sessionId },
      output: { success, latencyMs },
      metadata: {
        sessionId: currentSession?.sessionId,
        toolName,
        success,
        latencyMs,
        totalTools: toolCount,
        totalErrors: errorCount,
        ...metadata,
      },
    });
  });
}

/**
 * Record an LLM inference within the current session
 */
export async function recordInference(
  model: string,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await startActiveObservation("session:inference", async (span) => {
    span.update({
      input: { model, inputTokens },
      output: { outputTokens, latencyMs },
      metadata: {
        sessionId: currentSession?.sessionId,
        model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs,
        ...metadata,
      },
    });
  });
}

/**
 * End the current session and return metrics
 */
export async function endSession(metrics?: Partial<SessionMetrics>): Promise<SessionMetrics> {
  const durationMs = sessionStartTime ? Date.now() - sessionStartTime : 0;
  const successRate = toolCount > 0 ? ((toolCount - errorCount) / toolCount) * 100 : 100;

  const sessionMetrics: SessionMetrics = {
    sessionId: currentSession?.sessionId || "unknown",
    durationMs,
    toolCount,
    messageCount: metrics?.messageCount || 0,
    successRate,
    errors: metrics?.errors || [],
  };

  await startActiveObservation("session:end", async (span) => {
    span.update({
      input: { action: "session_end", sessionId: currentSession?.sessionId },
      output: { durationMs, successRate },
      metadata: {
        ...sessionMetrics,
        endTime: formatTimestamp(),
        hostname: getHostname(),
      },
    });
  });

  // Reset state
  currentSession = null;
  sessionStartTime = null;
  toolCount = 0;
  errorCount = 0;

  return sessionMetrics;
}

/**
 * Get current session context
 */
export function getCurrentSession(): SessionContext | null {
  return currentSession;
}

/**
 * Check if a session is active
 */
export function isSessionActive(): boolean {
  return currentSession !== null;
}
