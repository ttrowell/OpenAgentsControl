/**
 * Test script for Rich Trace Context
 * 
 * Sends traces with full context to Langfuse for verification:
 * - Agent context
 * - Task context
 * - User context
 * - Build context (git info)
 * - System context
 * - Error handling with stack traces
 */

import "./../observability/instrumentation.mjs";
import { langfuseSpanProcessor, observabilitySDK } from "./../observability/instrumentation.mjs";
import {
  startSession,
  endSession,
  recordToolCall,
  recordError,
  nextTurn,
} from "./../observability/collectors/session-collector.js";
import {
  recordInference,
} from "./../observability/collectors/model-collector.js";
import { getBuildContext, getSystemContext } from "./../observability/trace-context.js";

async function testRichContext() {
  console.log("🧪 Testing Rich Trace Context...\n");

  // Show what context will be captured
  console.log("📊 Build Context:");
  const buildCtx = getBuildContext();
  console.log(`   gitHash: ${buildCtx.gitHash}`);
  console.log(`   gitBranch: ${buildCtx.gitBranch}`);
  console.log(`   gitTag: ${buildCtx.gitTag || "none"}`);
  console.log(`   commitMessage: ${buildCtx.commitMessage?.slice(0, 50)}...`);
  console.log(`   version: ${buildCtx.version}`);
  console.log("");

  console.log("📊 System Context:");
  const sysCtx = getSystemContext();
  console.log(`   hostname: ${sysCtx.hostname}`);
  console.log(`   platform: ${sysCtx.platform}`);
  console.log(`   nodeVersion: ${sysCtx.nodeVersion}`);
  console.log(`   cwd: ${sysCtx.cwd}`);
  console.log("");

  // Generate unique session ID
  const sessionId = `rich-context-test-${Date.now()}`;
  console.log(`🔗 Starting session: ${sessionId}\n`);

  // Start session with rich context
  await startSession({
    sessionId,
    userId: "test-user@example.com",
    agentName: "test-agent",
    agentType: "orchestrator",
    agentVersion: "1.0.0",
    projectPath: "/Users/tara/workspace/openagentscontrol",
    task: {
      goal: "Test rich trace context with all metadata fields",
      taskId: `task-${Date.now()}`,
      workflowId: "workflow-test-001",
      constraints: ["must capture git info", "must capture system info"],
    },
    userMessage: "Please test the observability system with rich context",
    turnNumber: 1,
  });

  console.log("✅ Session started with rich context\n");

  // Simulate conversation turn
  nextTurn();
  console.log("📝 Turn 1: User message received");

  // Simulate a successful tool call
  console.log("\n🔧 Simulating tool call: Read");
  await recordToolCall("Read", true, 150, {
    filePath: "/tmp/test.txt",
    fileSize: 1024,
  });
  console.log("   ✓ Tool recorded");

  // Simulate another tool call
  nextTurn();
  console.log("\n🔧 Simulating tool call: Write");
  await recordToolCall("Write", true, 200, {
    filePath: "/tmp/output.txt",
    bytesWritten: 2048,
  });
  console.log("   ✓ Tool recorded");

  // Simulate LLM inference
  console.log("\n🤖 Simulating LLM inference");
  await recordInference({
    model: "claude-3-5-sonnet-20241022",
    inputTokens: 500,
    outputTokens: 150,
    latencyMs: 1200,
    cost: 0.0045,
    metadata: {
      promptTokens: 500,
      completionTokens: 150,
      cached: false,
    },
  });
  console.log("   ✓ Inference recorded");

  // Simulate an error with stack trace
  console.log("\n⚠️  Simulating error with stack trace");
  try {
    throw new Error("Simulated error for testing stack trace capture");
  } catch (err) {
    await recordError(err, {
      operation: "test-operation",
      toolName: "test-tool",
    });
    console.log("   ✓ Error recorded with full stack trace");
  }

  // Second turn
  nextTurn();
  console.log("\n📝 Turn 2: Processing response");

  // Another LLM call
  await recordInference({
    model: "gpt-4-turbo",
    inputTokens: 300,
    outputTokens: 200,
    latencyMs: 800,
    cost: 0.011,
    metadata: {
      promptTokens: 300,
      completionTokens: 200,
    },
  });
  console.log("   ✓ Second inference recorded");

  // End session
  console.log("\n🏁 Ending session...");
  const metrics = await endSession({
    messageCount: 2,
    errors: [],
  });

  console.log("\n📊 Session Metrics:");
  console.log(`   Duration: ${metrics.durationMs}ms`);
  console.log(`   Tool calls: ${metrics.toolCount}`);
  console.log(`   Success rate: ${metrics.successRate}%`);

  // Flush traces
  console.log("\n💾 Flushing traces to Langfuse...");
  await langfuseSpanProcessor.forceFlush();
  await observabilitySDK.shutdown();

  console.log("\n" + "=".repeat(60));
  console.log("✅ Rich context test complete!");
  console.log("=".repeat(60));
  console.log("\n📋 Session ID:", sessionId);
  console.log("📋 Git Hash:", buildCtx.gitHash);
  console.log("\n🔗 View in Langfuse dashboard:");
  console.log("   https://us.cloud.langfuse.com");
  console.log("   → Filter by sessionId:", sessionId);
  console.log("   → Look for spans with full metadata:");
  console.log("     - agent.name, agent.type, agent.version");
  console.log("     - task.id, task.goal, task.workflowId");
  console.log("     - build.gitHash, build.gitBranch, build.version");
  console.log("     - system.hostname, system.platform, system.nodeVersion");
  console.log("     - error.stack (for failed operations)");
  console.log("\n⏱️  Note: Traces may take 1-2 minutes to appear\n");
}

testRichContext().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
