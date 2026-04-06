import "./../../.opencode/observability/instrumentation.mjs";
import { langfuseSpanProcessor, observabilitySDK } from "./../../.opencode/observability/instrumentation.mjs";
import { startActiveObservation, getActiveTraceId } from "@langfuse/tracing";

async function testLangfuse() {
  console.log('🧪 Testing Langfuse + OpenTelemetry integration...\n');
  
  console.log('🔍 Environment check:');
  console.log(`   - LANGFUSE_PUBLIC_KEY: ${process.env.LANGFUSE_PUBLIC_KEY ? 'SET ✓' : 'MISSING ✗'}`);
  console.log(`   - LANGFUSE_SECRET_KEY: ${process.env.LANGFUSE_SECRET_KEY ? 'SET ✓' : 'MISSING ✗'}`);
  console.log(`   - LANGFUSE_BASE_URL: ${process.env.LANGFUSE_BASE_URL || 'default (cloud.langfuse.com)'}`);
  console.log('');

  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

  try {
    console.log('📡 Creating observability trace...');
    
    const traceId = await startActiveObservation('openagents-control-test', async (span) => {
      span.update({ 
        input: { message: "Hello from OpenAgents Control" },
        output: { status: "completed" },
        metadata: {
          agent: "openagent",
          test: "smoke-test",
          timestamp: new Date().toISOString(),
          version: "0.7.1",
          nodeVersion: process.version
        }
      });
    });

    console.log("✅ Trace created successfully");
    
    // Explicit flush for short-lived scripts (CRITICAL per Langfuse FAQ)
    console.log("🧹 Explicitly flushing events to Langfuse...");
    await langfuseSpanProcessor.forceFlush();
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 TEST COMPLETED - Data sent to Langfuse");
    console.log("=".repeat(60));
    console.log("");
    console.log("📊 VERIFICATION STEPS:");
    console.log("");
    console.log("1. Wait 1-2 minutes for traces to appear (async processing)");
    console.log("");
    console.log("2. Check traces via API:");
    const apiCmd = `curl -s -u "${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}" \\
  "${baseUrl}/api/public/traces?limit=1" | jq '{name: .data[0].name, id: .data[0].id}'`;
    console.log("   " + apiCmd.replace(/\\n/g, ' '));
    console.log("");
    console.log("3. View in dashboard:");
    console.log(`   ${baseUrl}`);
    console.log("");
    console.log("   Look for trace: openagents-control-test");
    console.log("=".repeat(60));
    
    // Graceful shutdown
    await observabilitySDK.shutdown();

  } catch (error) {
    console.error("\n❌ Langfuse test failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

testLangfuse();