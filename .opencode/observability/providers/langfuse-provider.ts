import { Langfuse } from 'langfuse';
import { Span, Tracer } from '@opentelemetry/api';

export interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  baseUrl?: string;
  project?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export class LangfuseProvider {
  private langfuse: Langfuse;
  private config: LangfuseConfig;

  constructor(config: LangfuseConfig) {
    this.config = config;

    this.langfuse = new Langfuse({
      publicKey: config.publicKey,
      secretKey: config.secretKey,
      baseUrl: config.baseUrl || 'https://cloud.langfuse.com',
      // Additional config can be added here
    });
  }

  // Initialize the provider
  async initialize(): Promise<void> {
    // Langfuse SDK handles initialization internally
    // We can add any custom setup here if needed
  }

  // Create a trace in Langfuse
  async createTrace(
    name: string,
    input?: any,
    metadata?: Record<string, any>,
    tags?: string[]
  ) {
    return this.langfuse.trace({
      name,
      input,
      metadata: {
        ...this.config.metadata,
        ...metadata,
      },
      tags: [...(this.config.tags || []), ...(tags || [])],
    });
  }

  // Create a span within a trace
  async createSpan(
    trace: any,
    name: string,
    input?: any,
    metadata?: Record<string, any>
  ) {
    return trace.span({
      name,
      input,
      metadata,
    });
  }

  // Record an event
  async recordEvent(
    name: string,
    input?: any,
    output?: any,
    metadata?: Record<string, any>
  ) {
    return this.langfuse.event({
      name,
      input,
      output,
      metadata,
    });
  }

  // Score a trace (for evaluation)
  async scoreTrace(
    traceId: string,
    name: string,
    value: number,
    comment?: string,
    metadata?: Record<string, any>
  ) {
    return this.langfuse.score({
      traceId,
      name,
      value,
      comment,
      metadata,
    });
  }

  // Convert OpenTelemetry span to Langfuse span
  async convertOtelSpan(
    otelSpan: Span,
    traceName: string,
    input?: any,
    output?: any
  ) {
    const span = await this.createSpan(
      await this.createTrace(traceName, input),
      otelSpan.name,
      input
    );

    // Add span attributes as metadata
    const attributes = otelSpan.attributes || {};
    span.update({
      metadata: attributes,
      output,
    });

    // End the span with timing
    span.end();

    return span;
  }

  // Flush all pending data
  async flush(): Promise<void> {
    await this.langfuse.flush();
  }

  // Shutdown the provider
  async shutdown(): Promise<void> {
    await this.langfuse.shutdown();
  }

  // Get the underlying Langfuse instance for advanced usage
  getLangfuse(): Langfuse {
    return this.langfuse;
  }
}

// Factory function for creating provider
export function createLangfuseProvider(config: LangfuseConfig): LangfuseProvider {
  return new LangfuseProvider(config);
}

// Helper to check if Langfuse is configured
export function isLangfuseConfigured(config: LangfuseConfig): boolean {
  return !!(config.publicKey && config.secretKey);
}