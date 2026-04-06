/**
 * Cost Collector - Tracks and links cost data to traces
 * 
 * Provides visibility into spending:
 * - Total cost by model
 * - Cost by session/project
 * - Daily/hourly cost breakdowns
 * - Cost trends
 */

import { startActiveObservation } from "@langfuse/tracing";

// Types
export interface CostRecord {
  id: string;
  timestamp: Date;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number;
  sessionId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface CostSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalInvocations: number;
  avgCostPerCall: number;
  byModel: Record<string, { cost: number; invocations: number; tokens: number }>;
  byProvider: Record<string, { cost: number; invocations: number }>;
}

export interface CostTrend {
  timestamp: Date;
  cost: number;
  invocations: number;
}

// State
const costRecords: CostRecord[] = [];
const MAX_COST_RECORDS = 10000;

// Pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
  "claude-3-5-sonnet": { input: 3.0, output: 15.0 },
  "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
  "claude-3-opus": { input: 15.0, output: 75.0 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
  // OpenAI
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "gpt-4": { input: 30.0, output: 60.0 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "o1-preview": { input: 15.0, output: 60.0 },
  "o1-mini": { input: 3.0, output: 12.0 },
  // Google
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.0-pro": { input: 0.125, output: 0.5 },
  // xAI
  "grok-2": { input: 2.0, output: 10.0 },
  "grok-code-fast": { input: 0.5, output: 2.0 },
};

/**
 * Calculate cost for tokens
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || { input: 1.0, output: 2.0 };
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Record a cost event
 */
export function recordCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cost?: number,
  metadata?: Record<string, unknown>
): CostRecord {
  const resolvedCost = cost ?? calculateCost(model, inputTokens, outputTokens);
  const provider = extractProvider(model);

  const record: CostRecord = {
    id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    model,
    provider,
    inputTokens,
    outputTokens,
    cost: resolvedCost,
    latencyMs: 0,
    metadata,
  };

  costRecords.push(record);

  // Trim if too many
  if (costRecords.length > MAX_COST_RECORDS) {
    costRecords.splice(0, costRecords.length - MAX_COST_RECORDS);
  }

  return record;
}

/**
 * Link cost to a trace
 */
export async function linkCostToTrace(
  costRecord: CostRecord,
  fn: () => Promise<unknown>
): Promise<{ result: unknown; costRecord: CostRecord }> {
  const start = Date.now();

  try {
    const result = await fn();

    const latencyMs = Date.now() - start;
    costRecord.latencyMs = latencyMs;

    // Create span with cost info
    await startActiveObservation(`cost:${costRecord.model}`, async (span) => {
      span.update({
        metadata: {
          model: costRecord.model,
          provider: costRecord.provider,
          inputTokens: costRecord.inputTokens,
          outputTokens: costRecord.outputTokens,
          costUsd: costRecord.cost,
          latencyMs,
          totalTokens: costRecord.inputTokens + costRecord.outputTokens,
        },
      });
    });

    return { result, costRecord };
  } catch (err) {
    costRecord.latencyMs = Date.now() - start;
    throw err;
  }
}

/**
 * Get cost summary
 */
export function getCostSummary(): CostSummary {
  const byModel: CostSummary["byModel"] = {};
  const byProvider: CostSummary["byProvider"] = {};

  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const record of costRecords) {
    totalCost += record.cost;
    totalInputTokens += record.inputTokens;
    totalOutputTokens += record.outputTokens;

    // By model
    if (!byModel[record.model]) {
      byModel[record.model] = { cost: 0, invocations: 0, tokens: 0 };
    }
    byModel[record.model].cost += record.cost;
    byModel[record.model].invocations++;
    byModel[record.model].tokens += record.inputTokens + record.outputTokens;

    // By provider
    if (!byProvider[record.provider]) {
      byProvider[record.provider] = { cost: 0, invocations: 0 };
    }
    byProvider[record.provider].cost += record.cost;
    byProvider[record.provider].invocations++;
  }

  return {
    totalCost,
    totalInputTokens,
    totalOutputTokens,
    totalInvocations: costRecords.length,
    avgCostPerCall: costRecords.length > 0 ? totalCost / costRecords.length : 0,
    byModel,
    byProvider,
  };
}

/**
 * Get cost records
 */
export function getCostRecords(limit?: number): CostRecord[] {
  if (limit) {
    return costRecords.slice(-limit);
  }
  return [...costRecords];
}

/**
 * Get cost by session
 */
export function getCostBySession(sessionId: string): CostRecord[] {
  return costRecords.filter((r) => r.sessionId === sessionId);
}

/**
 * Get cost trend (hourly breakdown)
 */
export function getCostTrend(hours: number = 24): CostTrend[] {
  const now = new Date();
  const trends: Map<string, CostTrend> = new Map();

  // Initialize hourly buckets
  for (let i = hours; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 60 * 60 * 1000);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    trends.set(key, { timestamp: date, cost: 0, invocations: 0 });
  }

  // Fill in costs
  for (const record of costRecords) {
    const ageHours = (now.getTime() - record.timestamp.getTime()) / (60 * 60 * 1000);
    if (ageHours <= hours) {
      const key = `${record.timestamp.getFullYear()}-${record.timestamp.getMonth()}-${record.timestamp.getDate()}-${record.timestamp.getHours()}`;
      const trend = trends.get(key);
      if (trend) {
        trend.cost += record.cost;
        trend.invocations++;
      }
    }
  }

  return Array.from(trends.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Reset cost records
 */
export function resetCostRecords(): void {
  costRecords.length = 0;
}

/**
 * Format cost for display
 */
export function formatCurrency(amount: number): string {
  if (amount < 0.0001) {
    return `$${(amount * 1000000).toFixed(2)}µ`;
  }
  if (amount < 0.01) {
    return `$${(amount * 1000).toFixed(2)}m`;
  }
  return `$${amount.toFixed(4)}`;
}

// Helper
function extractProvider(model: string): string {
  if (model.includes("claude")) return "anthropic";
  if (model.includes("gpt") || model.includes("o1")) return "openai";
  if (model.includes("gemini")) return "google";
  if (model.includes("grok")) return "xai";
  return "unknown";
}
