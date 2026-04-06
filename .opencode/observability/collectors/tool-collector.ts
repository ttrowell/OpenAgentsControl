/**
 * Tool Collector - Tracks tool execution metrics
 * 
 * Provides visibility into tool performance:
 * - Execution time by tool
 * - Success/error rates
 * - Most used tools
 * - Slowest tools
 */

import { startActiveObservation } from "@langfuse/tracing";

// Types
export interface ToolMetrics {
  name: string;
  invocations: number;
  successes: number;
  failures: number;
  successRate: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  lastUsed: Date | null;
  errors: string[];
}

export interface ToolCall {
  tool: string;
  success: boolean;
  latencyMs: number;
  timestamp: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

// State
const toolMetrics: Map<string, ToolMetrics> = new Map();
const recentCalls: ToolCall[] = [];
const MAX_RECENT_CALLS = 100;

/**
 * Record a tool call
 */
export function recordTool(tool: string, success: boolean, latencyMs: number, error?: string, metadata?: Record<string, unknown>): void {
  // Get or create metrics
  let metrics = toolMetrics.get(tool);
  if (!metrics) {
    metrics = {
      name: tool,
      invocations: 0,
      successes: 0,
      failures: 0,
      successRate: 100,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      minLatencyMs: Infinity,
      maxLatencyMs: 0,
      lastUsed: null,
      errors: [],
    };
    toolMetrics.set(tool, metrics);
  }

  // Update metrics
  metrics.invocations++;
  if (success) {
    metrics.successes++;
  } else {
    metrics.failures++;
    if (error) {
      metrics.errors.push(error);
      // Keep only last 10 errors
      if (metrics.errors.length > 10) {
        metrics.errors = metrics.errors.slice(-10);
      }
    }
  }
  metrics.successRate = (metrics.successes / metrics.invocations) * 100;
  metrics.totalLatencyMs += latencyMs;
  metrics.avgLatencyMs = Math.round(metrics.totalLatencyMs / metrics.invocations);
  metrics.minLatencyMs = Math.min(metrics.minLatencyMs, latencyMs);
  metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, latencyMs);
  metrics.lastUsed = new Date();

  // Track recent calls
  recentCalls.push({
    tool,
    success,
    latencyMs,
    timestamp: new Date(),
    error,
    metadata,
  });

  // Trim if too many
  if (recentCalls.length > MAX_RECENT_CALLS) {
    recentCalls.splice(0, recentCalls.length - MAX_RECENT_CALLS);
  }
}

/**
 * Get metrics for a specific tool
 */
export function getToolMetrics(tool: string): ToolMetrics | undefined {
  return toolMetrics.get(tool);
}

/**
 * Get all tool metrics
 */
export function getAllToolMetrics(): ToolMetrics[] {
  return Array.from(toolMetrics.values());
}

/**
 * Get recent tool calls
 */
export function getRecentCalls(limit?: number): ToolCall[] {
  if (limit) {
    return recentCalls.slice(-limit);
  }
  return [...recentCalls];
}

/**
 * Get tool summary
 */
export function getToolSummary(): {
  totalInvocations: number;
  totalTools: number;
  totalErrors: number;
  avgSuccessRate: number;
  slowestTool: ToolMetrics | null;
  mostUsedTool: ToolMetrics | null;
  errorRate: number;
} {
  let totalInvocations = 0;
  let totalSuccesses = 0;
  let totalFailures = 0;
  let slowestTool: ToolMetrics | null = null;
  let mostUsedTool: ToolMetrics | null = null;

  for (const metrics of Array.from(toolMetrics.values())) {
    totalInvocations += metrics.invocations;
    totalSuccesses += metrics.successes;
    totalFailures += metrics.failures;

    if (!slowestTool || metrics.avgLatencyMs > slowestTool.avgLatencyMs) {
      slowestTool = metrics;
    }

    if (!mostUsedTool || metrics.invocations > mostUsedTool.invocations) {
      mostUsedTool = metrics;
    }
  }

  return {
    totalInvocations,
    totalTools: toolMetrics.size,
    totalErrors: totalFailures,
    avgSuccessRate: totalInvocations > 0 ? (totalSuccesses / totalInvocations) * 100 : 100,
    slowestTool,
    mostUsedTool,
    errorRate: totalInvocations > 0 ? (totalFailures / totalInvocations) * 100 : 0,
  };
}

/**
 * Reset all tool metrics
 */
export function resetToolMetrics(): void {
  toolMetrics.clear();
  recentCalls.length = 0;
}

/**
 * Format latency for display
 */
export function formatToolLatency(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Create a span for a tool call
 */
export async function createToolSpan(
  tool: string,
  args: Record<string, unknown>,
  fn: () => Promise<unknown>
): Promise<{ result: unknown; metrics: ToolMetrics }> {
  const start = Date.now();
  let success = true;
  let errorMessage: string | undefined;

  try {
    const result = await fn();

    // Record the tool call
    recordTool(tool, true, Date.now() - start);

    // Create span
    await startActiveObservation(`tool:${tool}`, async (span) => {
      span.update({
        input: args,
        output: result,
        metadata: {
          success: true,
          latencyMs: Date.now() - start,
        },
      });
    });

    return {
      result,
      metrics: toolMetrics.get(tool)!,
    };
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - start;

    // Record failed tool call
    recordTool(tool, false, latencyMs, errorMessage);

    // Create span
    await startActiveObservation(`tool:${tool}`, async (span) => {
      span.update({
        input: args,
        metadata: {
          success: false,
          error: errorMessage,
          latencyMs,
        },
      });
    });

    throw err;
  }
}
