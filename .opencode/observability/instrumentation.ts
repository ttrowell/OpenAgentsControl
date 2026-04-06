import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

/**
 * Initialize OpenTelemetry with Langfuse Span Processor.
 * This must be imported as the VERY FIRST thing in your application
 * to ensure all spans are captured.
 * 
 * Use exportMode: 'immediate' for CLI scripts and serverless functions.
 */
export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  exportMode: "immediate",
});

export const observabilitySDK = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor],
});

observabilitySDK.start();

console.log("✅ Langfuse OpenTelemetry initialized");

// Helper for graceful shutdown
export async function flushAndShutdown() {
  await langfuseSpanProcessor.forceFlush();
  await observabilitySDK.shutdown();
}
