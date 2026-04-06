/**
 * OpenAgents Control Observability - Langfuse v5 SDK with Debug Mode
 * 
 * Debug logging is enabled by default in development.
 * Uses the new observation-centric model with propagateAttributes().
 */

import { 
  propagateAttributes, 
  startActiveObservation 
} from "@langfuse/tracing";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔧 Initializing Langfuse v5 SDK...');

// Enable debug logging by default in development
if (!process.env.LANGFUSE_LOG_LEVEL) {
  process.env.LANGFUSE_LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'WARN' : 'DEBUG';
  console.log(`🔧 Debug mode enabled (LANGFUSE_LOG_LEVEL=${process.env.LANGFUSE_LOG_LEVEL})`);
}

// Load .env file if it exists
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env' });
  console.log('📄 Loaded .env file');
} catch (e) {
  console.log('ℹ️  dotenv not available, skipping .env file');
}

// Load configuration
function loadConfig() {
  const configPath = path.join(process.cwd(), '.config/oac/observability.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('✅ Loaded v5 configuration from observability.json');
      
      if (fileConfig.langfuse?.publicKey) process.env.LANGFUSE_PUBLIC_KEY = fileConfig.langfuse.publicKey;
      if (fileConfig.langfuse?.secretKey) process.env.LANGFUSE_SECRET_KEY = fileConfig.langfuse.secretKey;
      if (fileConfig.langfuse?.baseUrl) process.env.LANGFUSE_BASE_URL = fileConfig.langfuse.baseUrl;
      
      return fileConfig;
    } catch (e) {
      console.warn('⚠️ Failed to load config:', e.message);
    }
  }
  return {};
}

const config = loadConfig();

console.log(`🔑 Keys loaded - Public: ${process.env.LANGFUSE_PUBLIC_KEY ? 'YES' : 'NO'}`);

/**
 * Creates a trace with attributes using the v5 propagateAttributes pattern
 */
export async function createTrace(name, metadata = {}) {
  console.log(`📊 Creating v5 trace: ${name}`);
  
  const traceId = `trace-${Date.now()}`;
  
  try {
    await propagateAttributes({
      traceName: name,
      userId: metadata.userId || "system",
      sessionId: metadata.sessionId || `session-${Date.now()}`,
      tags: ["openagents", "test"],
      metadata: {
        ...metadata,
        traceId,
        source: "openagents-control",
        environment: process.env.NODE_ENV || "development"
      }
    }, async () => {
      await startActiveObservation(name, async (observation) => {
        observation.update({
          input: metadata.input || metadata,
          output: metadata.output || { status: "completed" },
          metadata: {
            testType: "v5-migration",
            timestamp: new Date().toISOString()
          }
        });
      });
    });
    
    console.log(`✅ v5 Trace created successfully: ${traceId}`);
    return { id: traceId, name, success: true };
    
  } catch (error) {
    console.error(`❌ v5 Trace creation failed:`, error.message);
    throw error;
  }
}

/**
 * Legacy compatibility for ObservabilityAgent
 */
export function initObservability() {
  console.log('✅ v5 Observability provider initialized');
  return {
    createTrace,
    getLangfuseProvider: () => ({
      flush: async () => {
        console.log('🧹 Flushing v5 traces...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
      }
    })
  };
}

export { config };
export default { createTrace, initObservability, config };
