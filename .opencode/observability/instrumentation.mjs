import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

/**
 * Initialize OpenTelemetry with Langfuse Span Processor.
 * This must be imported VERY EARLY in your application.
 * 
 * Use exportMode: 'immediate' for CLI scripts and serverless functions
 * to ensure traces are flushed before the process exits.
 */
export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  exportMode: "immediate",
});

export const observabilitySDK = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor],
});

observabilitySDK.start();

console.log("✅ Langfuse OpenTelemetry initialized");

// Auto-detect and load project-specific observability
// This runs after framework initialization and checks if the current project
// has its own observability setup
import "./auto-init.mjs";

// Helper for graceful shutdown
export async function flushAndShutdown() {
  await langfuseSpanProcessor.forceFlush();
  await observabilitySDK.shutdown();
}
