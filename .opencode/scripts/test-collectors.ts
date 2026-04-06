/**
 * Test script for Observability Collectors
 * 
 * Demonstrates:
 * - Session collection
 * - Model metrics collection
 * - CLI integration
 */

import "./../observability/instrumentation.mjs";
import { langfuseSpanProcessor, observabilitySDK } from "./../observability/instrumentation.mjs";
import { startSession, recordToolCall, recordInference, endSession } from "../observability/collectors/session-collector.ts";
import { recordInference as recordModelInference, getAllModelMetrics, getModelSummary, formatCost, resetMetrics } from "../observability/collectors/model-collector.ts";

async function testCollectors() {
  console.log("🧪 Testing Observability Collectors...\n");

  // Reset any previous metrics
  resetMetrics();

  // Test 1: Session Collection
  console.log("📊 Test 1: Session Collection");
  console.log("─".repeat(40));

  const sessionId = `test-session-${Date.now()}`;
  await startSession({
    sessionId,
    userId: "test-user",
    agentName: "test-agent",
    projectPath: "/tmp/test",
  });
  console.log(`✓ Started session: ${sessionId}`);

  // Simulate some tool calls
  await recordToolCall("read", true, 150);
  console.log("✓ Recorded tool call: read (150ms)");
  
  await recordToolCall("write", true, 200);
  console.log("✓ Recorded tool call: write (200ms)");
  
  await recordToolCall("bash", false, 500, { error: "Permission denied" });
  console.log("✓ Recorded tool call: bash (500ms, failed)");

  // Simulate inference
  await recordInference("claude-3-5-sonnet-20241022", 500, 150, 1200);
  console.log("✓ Recorded inference: claude-3-5-sonnet");

  // End session
  const sessionMetrics = await endSession();
  console.log(`✓ Ended session (${sessionMetrics.toolCount} tools, ${sessionMetrics.successRate.toFixed(0)}% success)`);
  console.log("");

  // Test 2: Model Collection
  console.log("📊 Test 2: Model Collection");
  console.log("─".repeat(40));

  // Record some model inferences
  recordModelInference({
    model: "claude-3-5-sonnet-20241022",
    inputTokens: 1000,
    outputTokens: 500,
    latencyMs: 1500,
    cost: 0.0225,
  });
  console.log("✓ Recorded: claude-3-5-sonnet inference");

  recordModelInference({
    model: "gpt-4-turbo",
    inputTokens: 800,
    outputTokens: 400,
    latencyMs: 2000,
    cost: 0.032,
  });
  console.log("✓ Recorded: gpt-4-turbo inference");

  recordModelInference({
    model: "gemini-1.5-flash",
    inputTokens: 2000,
    outputTokens: 1000,
    latencyMs: 800,
    cost: 0.00075,
  });
  console.log("✓ Recorded: gemini-1.5-flash inference");

  // Get and display model summary
  const summary = getModelSummary();
  console.log("\n📈 Model Summary:");
  console.log(`  Total Invocations: ${summary.totalInvocations}`);
  console.log(`  Total Tokens: ${summary.totalTokens.toLocaleString()}`);
  console.log(`  Total Cost: ${formatCost(summary.totalCost)}`);

  const allMetrics = getAllModelMetrics();
  console.log("\n📊 Per-Model Metrics:");
  for (const metrics of allMetrics) {
    console.log(`  ${metrics.model}:`);
    console.log(`    - Invocations: ${metrics.invocations}`);
    console.log(`    - Tokens: ${(metrics.totalInputTokens + metrics.totalOutputTokens).toLocaleString()}`);
    console.log(`    - Avg Latency: ${metrics.avgLatencyMs}ms`);
    console.log(`    - Cost: ${formatCost(metrics.totalCost)}`);
  }

  console.log("\n" + "=".repeat(40));
  console.log("✅ All collector tests passed!");
  console.log("=".repeat(40));
  console.log("\n📝 Next steps:");
  console.log("  1. Flush traces to Langfuse...");
  await langfuseSpanProcessor.forceFlush();
  console.log("  2. Check your Langfuse dashboard");
  console.log("  3. Or run: oac observe list");
  await observabilitySDK.shutdown();
}

testCollectors().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
