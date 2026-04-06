/**
 * SessionCollector - Links Langfuse traces to OAC sessions
 * 
 * This collector provides session-level observability by:
 * - Creating traces with rich context (agent, task, user, build info)
 * - Tracking session lifecycle events
 * - Linking session metrics to traces
 * - Capturing enhanced error details with stack traces
 * 
 * IMPORTANT: Uses Langfuse's sessionId field for proper session linking
 * @see https://langfuse.com/docs/observability/features/sessions
 */

import { startActiveObservation, propagateAttributes } from "@langfuse/tracing";
import * as os from "node:os";
import {
  createTraceContext,
  captureError,
  toAttributes,
  toMetadata,
  getBuildContext,
  getSystemContext,
  type AgentContext,
  type TaskContext,
  type UserContext,
  type TraceContext,
} from "../trace-context.js";

// Re-export types
export type { AgentContext, TaskContext, UserContext, TraceContext };

// Types
export interface SessionContext {
  sessionId: string;
  userId?: string;
  agentName?: string;
  agentType?: string;
  agentVersion?: string;
  projectPath?: string;
  task?: TaskContext;
  userMessage?: string;
  turnNumber?: number;
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
let currentTraceContext: TraceContext | null = null;
let sessionStartTime: number | null = null;
let toolCount = 0;
let errorCount = 0;
let turnNumber = 0;

// Pure helper functions
const getHostname = (): string => os.hostname();

const getUsername = (): string => os.userInfo().username;

const formatTimestamp = (date: Date = new Date()): string => date.toISOString();

/**
 * Start a new session observation
 * 
 * Creates a trace with rich context:
 * - Session ID for linking
 * - Agent context (name, type, version)
 * - Task context (goal, constraints, taskId)
 * - User context (message, turn number)
 * - Build context (git hash, branch, version)
 * - System context (hostname, platform, etc.)
 * 
 * @see https://langfuse.com/docs/observability/features/sessions
 */
export async function startSession(context: SessionContext): Promise<void> {
  currentSession = context;
  sessionStartTime = Date.now();
  toolCount = 0;
  errorCount = 0;
  turnNumber = 0;

  // Build agent context
  const agent: AgentContext = {
    name: context.agentName || "unknown",
    type: context.agentType || "agent",
    version: context.agentVersion,
  };

  // Build task context
  const task: TaskContext | undefined = context.task
    ? {
        goal: context.task.goal,
        constraints: context.task.constraints,
        taskId: context.task.taskId,
        workflowId: context.task.workflowId,
      }
    : undefined;

  // Build user context
  const user: UserContext | undefined = context.userMessage
    ? {
        message: context.userMessage,
        turnNumber: context.turnNumber || 0,
        userId: context.userId,
        sessionType: "oac-session",
      }
    : undefined;

  // Create full trace context
  currentTraceContext = createTraceContext(agent, { task, user });

  // Convert to flat attributes for propagation
  const attributes = toAttributes(currentTraceContext);

  // Create session within propagated context
  // This ensures the session is created and traces are linked
  await propagateAttributes({
    sessionId: context.sessionId,
    userId: context.userId || getUsername(),
    metadata: {
      // Preserve original metadata
      agentName: context.agentName || "",
      agentType: context.agentType || "",
      projectPath: context.projectPath || "",
      hostname: getHostname(),
      // Add trace context metadata
      ...toMetadata(currentTraceContext),
    },
    tags: ["oac-session"],
  }, async () => {
    // Create the initial span within the propagated context
    // This span will have sessionId/userId set via context propagation
    await startActiveObservation("session:start", async (span) => {
      span.update({
        input: {
          action: "session_start",
          sessionId: context.sessionId,
          agentName: agent.name,
          agentType: agent.type,
        },
        metadata: {
          // Timing
          startTime: formatTimestamp(),
          // Agent info
          agentName: agent.name,
          agentType: agent.type,
          agentVersion: agent.version || getBuildContext().version,
          // Task info
          taskGoal: task?.goal,
          taskId: task?.taskId,
          taskConstraints: task?.constraints?.length || 0,
          // User info
          userMessage: context.userMessage?.slice(0, 500), // Truncate for span
          turnNumber: context.turnNumber || 0,
          // Build info
          gitHash: currentTraceContext?.build.gitHash,
          gitBranch: currentTraceContext?.build.gitBranch,
          gitTag: currentTraceContext?.build.gitTag,
          buildVersion: currentTraceContext?.build.version,
          // System info
          hostname: getHostname(),
          platform: currentTraceContext?.system.platform,
          nodeVersion: currentTraceContext?.system.nodeVersion,
          projectPath: context.projectPath || "",
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
        // Session tracking
        sessionId: currentSession?.sessionId,
        // Tool info
        toolName,
        success,
        latencyMs,
        totalTools: toolCount,
        totalErrors: errorCount,
        // Agent context
        agentName: currentSession?.agentName,
        agentType: currentSession?.agentType,
        // Task context
        taskId: currentSession?.task?.taskId,
        // Build context (for correlation)
        gitHash: currentTraceContext?.build.gitHash,
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
        // Session tracking
        sessionId: currentSession?.sessionId,
        // Model info
        model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs,
        // Agent context
        agentName: currentSession?.agentName,
        agentType: currentSession?.agentType,
        // Task context
        taskId: currentSession?.task?.taskId,
        taskGoal: currentSession?.task?.goal?.slice(0, 200),
        // Build context
        gitHash: currentTraceContext?.build.gitHash,
        buildVersion: currentTraceContext?.build.version,
        ...metadata,
      },
    });
  });
}

/**
 * Record an error with enhanced context including stack trace
 */
export async function recordError(
  error: unknown,
  context?: {
    operation?: string;
    toolName?: string;
    model?: string;
  }
): Promise<void> {
  const err = captureError(error);
  errorCount++;

  await startActiveObservation("session:error", async (span) => {
    span.update({
      input: {
        operation: context?.operation || "unknown",
        toolName: context?.toolName,
        model: context?.model,
      },
      output: {
        success: false,
        errorHandled: true,
      },
      metadata: {
        // Error details
        errorMessage: err.message,
        errorName: err.name,
        errorCode: err.code,
        errorStack: err.stack, // Full stack trace!
        // Session tracking
        sessionId: currentSession?.sessionId,
        // Agent context
        agentName: currentSession?.agentName,
        agentType: currentSession?.agentType,
        // Task context
        taskId: currentSession?.task?.taskId,
        taskGoal: currentSession?.task?.goal?.slice(0, 200),
        // Build context
        gitHash: currentTraceContext?.build.gitHash,
        gitBranch: currentTraceContext?.build.gitBranch,
        buildVersion: currentTraceContext?.build.version,
        // System info
        hostname: currentTraceContext?.system.hostname,
        platform: currentTraceContext?.system.platform,
        nodeVersion: currentTraceContext?.system.nodeVersion,
        cwd: currentTraceContext?.system.cwd,
        // Error count
        totalErrors: errorCount,
      },
    });
  });
}

/**
 * Increment turn number and return current turn
 */
export function nextTurn(): number {
  turnNumber++;
  return turnNumber;
}

/**
 * Get current turn number
 */
export function getTurnNumber(): number {
  return turnNumber;
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
    messageCount: metrics?.messageCount || turnNumber,
    successRate,
    errors: metrics?.errors || [],
  };

  await startActiveObservation("session:end", async (span) => {
    span.update({
      input: { action: "session_end", sessionId: currentSession?.sessionId },
      output: { durationMs, successRate },
      metadata: {
        // Session metrics
        ...sessionMetrics,
        // Timing
        endTime: formatTimestamp(),
        // Turn count
        turnCount: turnNumber,
        // Agent context
        agentName: currentSession?.agentName,
        agentType: currentSession?.agentType,
        agentVersion: currentTraceContext?.build.version,
        // Task context
        taskId: currentSession?.task?.taskId,
        taskGoal: currentSession?.task?.goal?.slice(0, 200),
        // Build context
        gitHash: currentTraceContext?.build.gitHash,
        gitBranch: currentTraceContext?.build.gitBranch,
        gitTag: currentTraceContext?.build.gitTag,
        commitMessage: currentTraceContext?.build.commitMessage,
        buildVersion: currentTraceContext?.build.version,
        buildTime: currentTraceContext?.build.buildTime,
        // System info
        hostname: getHostname(),
        platform: currentTraceContext?.system.platform,
        nodeVersion: currentTraceContext?.system.nodeVersion,
        cwd: currentTraceContext?.system.cwd,
      },
    });
  });

  // Reset state
  currentSession = null;
  currentTraceContext = null;
  sessionStartTime = null;
  toolCount = 0;
  errorCount = 0;
  turnNumber = 0;

  return sessionMetrics;
}

/**
 * Get current session context
 */
export function getCurrentSession(): SessionContext | null {
  return currentSession;
}

/**
 * Get current trace context
 */
export function getTraceContext(): TraceContext | null {
  return currentTraceContext;
}

/**
 * Check if a session is active
 */
export function isSessionActive(): boolean {
  return currentSession !== null;
}
