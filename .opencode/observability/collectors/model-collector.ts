/**
 * ModelCollector - Tracks model performance metrics
 * 
 * This collector provides model-level observability by:
 * - Tracking inference latency
 * - Recording token usage
 * - Calculating costs
 * - Measuring cache hit rates
 */

// Types
export interface ModelMetrics {
  model: string;
  provider?: string;
  invocations: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  totalCost: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
}

export interface InferenceRecord {
  model: string;
  provider?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cacheHit?: boolean;
  cost?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Model pricing (USD per 1M tokens) - approximate
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
  "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "gpt-4": { input: 30.0, output: 60.0 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "grok-2": { input: 2.0, output: 10.0 },
  "grok-code-fast": { input: 0.5, output: 2.0 },
};

// State - per-model metrics
const modelMetrics: Map<string, ModelMetrics> = new Map();

const getDefaultPricing = () => ({ input: 1.0, output: 2.0 });

/**
 * Calculate cost for an inference
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || getDefaultPricing();
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Extract provider from model name
 */
export function extractProvider(model: string): string {
  if (model.includes("claude")) return "anthropic";
  if (model.includes("gpt") || model.includes("gpt-4") || model.includes("o1"))
    return "openai";
  if (model.includes("gemini")) return "google";
  if (model.includes("grok")) return "xai";
  return "unknown";
}

/**
 * Record an inference event
 */
export function recordInference(record: InferenceRecord): ModelMetrics {
  const { model, provider, inputTokens, outputTokens, latencyMs, cacheHit, error } = record;
  const resolvedProvider = provider || extractProvider(model);

  // Get or create metrics for this model
  let metrics = modelMetrics.get(model);
  if (!metrics) {
    metrics = {
      model,
      provider: resolvedProvider,
      invocations: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      minLatencyMs: Infinity,
      maxLatencyMs: 0,
      totalCost: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
    };
    modelMetrics.set(model, metrics);
  }

  // Update metrics
  metrics.invocations++;
  metrics.totalInputTokens += inputTokens;
  metrics.totalOutputTokens += outputTokens;
  metrics.totalLatencyMs += latencyMs;
  metrics.avgLatencyMs = Math.round(metrics.totalLatencyMs / metrics.invocations);
  metrics.minLatencyMs = Math.min(metrics.minLatencyMs, latencyMs);
  metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, latencyMs);

  if (cacheHit !== undefined) {
    if (cacheHit) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }
  }

  if (error) {
    metrics.errors++;
  } else {
    metrics.totalCost += calculateCost(model, inputTokens, outputTokens);
  }

  return metrics;
}

/**
 * Get metrics for a specific model
 */
export function getModelMetrics(model: string): ModelMetrics | undefined {
  return modelMetrics.get(model);
}

/**
 * Get all model metrics
 */
export function getAllModelMetrics(): ModelMetrics[] {
  return Array.from(modelMetrics.values());
}

/**
 * Get summary of all model metrics
 */
export function getModelSummary(): {
  totalInvocations: number;
  totalTokens: number;
  totalCost: number;
  totalErrors: number;
  modelCount: number;
} {
  let totalInvocations = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let totalErrors = 0;

  for (const metrics of Array.from(modelMetrics.values())) {
    totalInvocations += metrics.invocations;
    totalTokens += metrics.totalInputTokens + metrics.totalOutputTokens;
    totalCost += metrics.totalCost;
    totalErrors += metrics.errors;
  }

  return {
    totalInvocations,
    totalTokens,
    totalCost,
    totalErrors,
    modelCount: modelMetrics.size,
  };
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  modelMetrics.clear();
}

/**
 * Format cost as currency string
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(2)}K`; // mills
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Format latency in human-readable format
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}
