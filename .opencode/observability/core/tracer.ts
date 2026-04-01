import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, Tracer } from '@opentelemetry/api';

export interface TracerConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  team?: string;
}

export class ObservabilityTracer {
  private provider: NodeTracerProvider;
  private tracer: Tracer;

  constructor(config: TracerConfig) {
    // Create resource with service attributes
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
        ...(config.team && { 'team.name': config.team }),
      })
    );

    // Initialize tracer provider
    this.provider = new NodeTracerProvider({
      resource,
    });

    // Register the provider
    this.provider.register();

    // Get tracer instance
    this.tracer = trace.getTracer(config.serviceName, config.serviceVersion);
  }

  getTracer(): Tracer {
    return this.tracer;
  }

  async shutdown(): Promise<void> {
    await this.provider.shutdown();
  }
}

// Singleton instance
let tracerInstance: ObservabilityTracer | null = null;

export function initializeTracer(config: TracerConfig): ObservabilityTracer {
  if (tracerInstance) {
    throw new Error('Tracer already initialized');
  }

  tracerInstance = new ObservabilityTracer(config);
  return tracerInstance;
}

export function getTracer(): Tracer {
  if (!tracerInstance) {
    throw new Error('Tracer not initialized. Call initializeTracer() first.');
  }

  return tracerInstance.getTracer();
}

export function shutdownTracer(): Promise<void> {
  if (!tracerInstance) {
    return Promise.resolve();
  }

  const shutdownPromise = tracerInstance.shutdown();
  tracerInstance = null;
  return shutdownPromise;
}