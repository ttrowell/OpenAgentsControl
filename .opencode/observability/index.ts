// OpenAgents Control Observability Module
// TypeScript-native observability system using OpenTelemetry and Langfuse

export * from './core/tracer';
export * from './core/attributes';
export * from './providers/langfuse-provider';
export * from './config/observability.config';

// Re-export commonly used OpenTelemetry types
export type { Tracer, Span, SpanStatus } from '@opentelemetry/api';

// Main initialization function
import { initializeTracer, getTracer, shutdownTracer } from './core/tracer';
import { createLangfuseProvider, LangfuseProvider } from './providers/langfuse-provider';
import { loadConfig, getConfigLoader, ObservabilityConfigLoader } from './config/observability.config';

export interface ObservabilityInitOptions {
  configPath?: string;
  autoInitialize?: boolean;
}

export class Observability {
  private configLoader: ObservabilityConfigLoader;
  private langfuseProvider?: LangfuseProvider;
  private initialized = false;

  constructor(options: ObservabilityInitOptions = {}) {
    this.configLoader = getConfigLoader();

    if (options.configPath) {
      this.configLoader.loadFromFile(options.configPath);
    } else {
      loadConfig(); // Try to load from default locations
    }

    if (options.autoInitialize !== false) {
      this.initialize();
    }
  }

  // Initialize the observability system
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const config = this.configLoader.getConfig();

    if (!config.enabled) {
      return;
    }

    // Initialize tracer
    const tracerConfig = {
      serviceName: config.attributes?.['service.name'] || 'openagents-control',
      serviceVersion: config.attributes?.['service.version'] || '0.7.1',
      environment: config.attributes?.['deployment.environment'] || 'development',
      team: config.attributes?.['team.name'],
    };

    initializeTracer(tracerConfig);

    // Initialize Langfuse provider if configured
    if (config.provider === 'langfuse' && config.langfuse) {
      this.langfuseProvider = createLangfuseProvider(config.langfuse);
      await this.langfuseProvider.initialize();
    }

    this.initialized = true;
  }

  // Get the tracer instance
  getTracer() {
    return getTracer();
  }

  // Get the Langfuse provider
  getLangfuseProvider(): LangfuseProvider | undefined {
    return this.langfuseProvider;
  }

  // Create a new trace
  async createTrace(name: string, input?: any, metadata?: Record<string, any>, tags?: string[]) {
    if (!this.langfuseProvider) {
      throw new Error('Langfuse provider not initialized');
    }

    return this.langfuseProvider.createTrace(name, input, metadata, tags);
  }

  // Check if observability is enabled
  isEnabled(): boolean {
    return this.configLoader.isEnabled();
  }

  // Get sampling rate
  getSamplingRate(agentName?: string, modelName?: string): number {
    return this.configLoader.getSamplingRate(agentName, modelName);
  }

  // Shutdown the observability system
  async shutdown(): Promise<void> {
    if (this.langfuseProvider) {
      await this.langfuseProvider.shutdown();
    }

    await shutdownTracer();
    this.initialized = false;
  }
}

// Global instance
let globalObservability: Observability | null = null;

// Initialize global observability instance
export function initObservability(options: ObservabilityInitOptions = {}): Observability {
  if (globalObservability) {
    throw new Error('Observability already initialized');
  }

  globalObservability = new Observability(options);
  return globalObservability;
}

// Get global observability instance
export function getObservability(): Observability {
  if (!globalObservability) {
    throw new Error('Observability not initialized. Call initObservability() first.');
  }

  return globalObservability;
}

// Quick initialization for simple use cases
export async function quickInit(configPath?: string): Promise<Observability> {
  return initObservability({ configPath, autoInitialize: true });
}

// Utility functions for common operations
export { createAgentAttributes, createModelAttributes, createToolAttributes, createSessionAttributes, createProjectAttributes } from './core/attributes';