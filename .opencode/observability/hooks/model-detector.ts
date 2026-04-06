/**
 * Model Detector - Automatic model detection from multiple sources
 * 
 * Detection priority (most accurate first):
 * 1. API response headers (actual model used)
 * 2. Environment variable (CURRENT_MODEL)
 * 3. Config default (fallback)
 * 4. Manual override (explicit parameter)
 */

import { loadConfig } from "../config/observability.config.js";

// Types
export interface ModelInfo {
  model: string;
  provider: string;
  detectedFrom: "header" | "env" | "config" | "manual";
}

export interface LLMResponse {
  model?: string;
  headers?: Record<string, string>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

// Provider extraction
const PROVIDER_PATTERNS: Record<string, RegExp> = {
  anthropic: /claude/i,
  openai: /gpt|o1|o3/i,
  google: /gemini/i,
  xai: /grok/i,
  mistral: /mistral/i,
  cohere: /cohere|command/i,
};

// Default models by provider
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-3-5-sonnet-20241022",
  openai: "gpt-4-turbo",
  google: "gemini-1.5-flash",
  xai: "grok-2",
};

/**
 * Extract provider from model name
 */
export function extractProvider(model: string): string {
  for (const [provider, pattern] of Object.entries(PROVIDER_PATTERNS)) {
    if (pattern.test(model)) {
      return provider;
    }
  }
  return "unknown";
}

/**
 * Detect model from API response headers
 * 
 * Common headers:
 * - Anthropic: x-anthropic-model
 * - OpenAI: openai-model (or in response)
 * - Google: x-goog-api-model
 */
export function detectFromHeaders(
  headers: Record<string, string>,
  response?: LLMResponse
): string | null {
  // Anthropic
  if (headers["x-anthropic-model"]) {
    return headers["x-anthropic-model"];
  }

  // Google
  if (headers["x-goog-api-model"]) {
    return headers["x-goog-api-model"];
  }

  // OpenAI (sometimes in headers)
  if (headers["openai-model"] || headers["x-openai-model"]) {
    return headers["openai-model"] || headers["x-openai-model"] || null;
  }

  // Try from response body
  if (response?.model) {
    return response.model;
  }

  return null;
}

/**
 * Detect model from environment variable
 */
export function detectFromEnv(): string | null {
  return process.env.CURRENT_MODEL || null;
}

/**
 * Detect model from config
 */
export function detectFromConfig(): string | null {
  try {
    const config = loadConfig();
    return config.langfuse?.publicKey ? DEFAULT_MODELS.anthropic : null;
  } catch {
    return null;
  }
}

/**
 * Detect model from provider inference
 * 
 * If we know the provider but not the specific model,
 * return the default model for that provider.
 */
export function detectFromProvider(provider: string): string | null {
  return DEFAULT_MODELS[provider] || null;
}

/**
 * Detect model from API response (combined header + body)
 */
export function detectFromResponse(response: LLMResponse): ModelInfo | null {
  // Try headers first
  if (response.headers) {
    const model = detectFromHeaders(response.headers, response);
    if (model) {
      return {
        model,
        provider: extractProvider(model),
        detectedFrom: "header",
      };
    }
  }

  // Try body
  if (response.model) {
    return {
      model: response.model,
      provider: extractProvider(response.model),
      detectedFrom: "header", // Headers/body both indicate actual model
    };
  }

  return null;
}

/**
 * Get the current model with automatic detection
 * 
 * Priority:
 * 1. Manual override (explicit parameter)
 * 2. Environment variable
 * 3. Config default
 */
export function getCurrentModel(override?: string): ModelInfo {
  // 1. Manual override
  if (override) {
    return {
      model: override,
      provider: extractProvider(override),
      detectedFrom: "manual",
    };
  }

  // 2. Environment variable
  const envModel = detectFromEnv();
  if (envModel) {
    return {
      model: envModel,
      provider: extractProvider(envModel),
      detectedFrom: "env",
    };
  }

  // 3. Config
  const configModel = detectFromConfig();
  if (configModel) {
    return {
      model: configModel,
      provider: extractProvider(configModel),
      detectedFrom: "config",
    };
  }

  // 4. Default (unknown)
  return {
    model: "unknown",
    provider: "unknown",
    detectedFrom: "config",
  };
}

/**
 * Set the current model (for use after detection)
 * 
 * This updates an environment variable that will be picked up
 * by subsequent auto-instrumentation calls.
 */
export function setCurrentModel(model: string): void {
  process.env.CURRENT_MODEL = model;
}

/**
 * Clear the current model
 */
export function clearCurrentModel(): void {
  delete process.env.CURRENT_MODEL;
}
