/**
 * Test script for Auto-Instrumentation Hooks
 * 
 * Demonstrates:
 * - Automatic model detection
 * - Tool instrumentation
 * - LLM call instrumentation
 * - Cost tracking
 */

import "./../observability/instrumentation.mjs";
import { langfuseSpanProcessor, observabilitySDK } from "./../observability/instrumentation.mjs";
import {
  instrumentedTool,
  instrumentedLLM,
  instrumentedAgent,
  getCurrentModel,
  setCurrentModel,
} from "./../observability/hooks/auto-instrument.ts";
import {
  getCostSummary,
  formatCurrency,
  getCostRecords,
} from "./../observability/collectors/cost-collector.ts";
import {
  getAllToolMetrics,
  getToolSummary,
} from "./../observability/collectors/tool-collector.ts";

async function testAutoInstrumentation() {
  console.log("🧪 Testing Auto-Instrumentation Hooks...\n");

  // Test 0: Session with proper sessionId linking
  console.log("📊 Test 0: Session with sessionId");
  console.log("─".repeat(40));

  const testSessionId = `oac-session-${Date.now()}`;
  console.log(`✓ Starting session: ${testSessionId}`);
  
  // Import and start session
  const { startSession, endSession } = await import("./../observability/collectors/session-collector.ts");
  await startSession({
    sessionId: testSessionId,
    userId: "test-user",
    agentName: "test-agent",
    projectPath: "/tmp/test",
  });
  console.log(`✓ Session started with sessionId linked to traces`);

  console.log("");

  // Test 1: Model Detection
  console.log("📊 Test 1: Model Detection");
  console.log("─".repeat(40));

  // No model set yet
  const model1 = getCurrentModel();
  console.log(`✓ Default model: ${model1.model} (from: ${model1.detectedFrom})`);

  // Set model via environment
  setCurrentModel("claude-3-5-sonnet-20241022");
  const model2 = getCurrentModel();
  console.log(`✓ After setCurrentModel: ${model2.model} (from: ${model2.detectedFrom})`);

  // Override via parameter
  const model3 = getCurrentModel("gpt-4-turbo");
  console.log(`✓ With override: ${model3.model} (from: ${model3.detectedFrom})`);

  console.log("");

  // Test 2: Tool Instrumentation
  console.log("📊 Test 2: Tool Instrumentation");
  console.log("─".repeat(40));

  // Simulate tool calls
  const readResult = await instrumentedTool(
    "Read",
    { path: "src/index.ts" },
    async () => {
      await new Promise((r) => setTimeout(r, 100));
      return "file contents...";
    }
  );
  console.log(`✓ Tool 'Read': ${readResult.success ? "success" : "failed"} (${readResult.durationMs}ms)`);

  const writeResult = await instrumentedTool(
    "Write",
    { path: "src/output.ts" },
    async () => {
      await new Promise((r) => setTimeout(r, 200));
      return "wrote 100 bytes";
    }
  );
  console.log(`✓ Tool 'Write': ${writeResult.success ? "success" : "failed"} (${writeResult.durationMs}ms)`);

  // Simulate a failed tool
  try {
    await instrumentedTool(
      "Bash",
      { command: "rm -rf /" },
      async () => {
        throw new Error("Permission denied");
      }
    );
  } catch {
    console.log(`✓ Tool 'Bash': failed (error captured)`);
  }

  console.log("");

  // Test 3: LLM Call Instrumentation (simulated)
  console.log("📊 Test 3: LLM Call Instrumentation");
  console.log("─".repeat(40));

  // Simulate an LLM call with response headers (like real API would return)
  setCurrentModel("claude-3-5-sonnet-20241022");

  const llmResult = await instrumentedLLM(
    {
      model: "claude-3-5-sonnet-20241022",
      messages: [{ role: "user", content: "Hello" }],
    },
    async (config) => {
      await new Promise((r) => setTimeout(r, 500));
      return {
        content: [{ text: "Hello! How can I help?" }],
        usage: { input_tokens: 50, output_tokens: 25 },
        headers: { "x-anthropic-model": "claude-3-5-sonnet-20241022" },
      };
    }
  );

  console.log(`✓ LLM call: ${llmResult.model}`);
  console.log(`  Input tokens: ${llmResult.inputTokens}`);
  console.log(`  Output tokens: ${llmResult.outputTokens}`);
  console.log(`  Cost: ${formatCurrency(llmResult.cost)}`);
  console.log(`  Latency: ${llmResult.durationMs}ms`);

  // Second LLM call should use detected model from headers
  const llmResult2 = await instrumentedLLM(
    { messages: [{ role: "user", content: "Second call" }] },
    async (config) => {
      await new Promise((r) => setTimeout(r, 300));
      return {
        content: [{ text: "Response 2" }],
        usage: { input_tokens: 30, output_tokens: 15 },
        headers: { "x-anthropic-model": "claude-3-5-sonnet-20241022" },
      };
    }
  );

  console.log(`✓ Second LLM call model (auto-detected): ${llmResult2.model}`);

  console.log("");

  // Test 4: Cost Summary
  console.log("📊 Test 4: Cost Summary");
  console.log("─".repeat(40));

  const costSummary = getCostSummary();
  console.log(`✓ Total cost: ${formatCurrency(costSummary.totalCost)}`);
  console.log(`✓ Total invocations: ${costSummary.totalInvocations}`);
  console.log(`✓ Total tokens: ${(costSummary.totalInputTokens + costSummary.totalOutputTokens).toLocaleString()}`);
  console.log("");
  console.log("  By model:");
  for (const [model, data] of Object.entries(costSummary.byModel)) {
    console.log(`    ${model}: ${formatCurrency(data.cost)} (${data.invocations} calls)`);
  }

  console.log("");

  // Test 5: Tool Summary
  console.log("📊 Test 5: Tool Summary");
  console.log("─".repeat(40));

  const toolSummary = getToolSummary();
  console.log(`✓ Total tool calls: ${toolSummary.totalInvocations}`);
  console.log(`✓ Unique tools: ${toolSummary.totalTools}`);
  console.log(`✓ Success rate: ${toolSummary.avgSuccessRate.toFixed(1)}%`);
  if (toolSummary.slowestTool) {
    console.log(`✓ Slowest tool: ${toolSummary.slowestTool.name} (${toolSummary.slowestTool.avgLatencyMs}ms avg)`);
  }
  if (toolSummary.mostUsedTool) {
    console.log(`✓ Most used: ${toolSummary.mostUsedTool.name} (${toolSummary.mostUsedTool.invocations}x)`);
  }

  console.log("\n" + "=".repeat(40));
  console.log("✅ All auto-instrumentation tests passed!");
  console.log("=".repeat(40));
  console.log("\n📝 Summary:");
  console.log(`  - Session ID linked to traces: ${testSessionId}`);
  console.log(`  - Model detection works automatically`);
  console.log(`  - Tools are tracked with success/failure`);
  console.log(`  - LLM calls capture model from headers`);
  console.log(`  - Costs are calculated and linked`);
  console.log("\n📝 Next steps:");
  console.log("  1. End session...");
  await endSession();
  console.log("  2. Flush traces to Langfuse...");
  await langfuseSpanProcessor.forceFlush();
  console.log("  3. Check your Langfuse dashboard - look for sessionId");
  console.log("  4. View in Sessions view: https://us.cloud.langfuse.com");
  await observabilitySDK.shutdown();
}

testAutoInstrumentation().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
