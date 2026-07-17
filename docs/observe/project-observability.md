# Project-Specific Observability

This guide explains how to enable observability for specific projects, allowing agents (OpenAgent, OpenCoder, SystemBuilder) to send traces directly to a project's own Langfuse configuration when working on that project.

## Overview

When agents act on a project, you can configure that project to have its own observability setup. This allows:

- **Project-level tracing** - Traces are associated with the project's own Langfuse project
- **Custom instrumentation** - Projects can provide their own observability behavior
- **Env-driven activation** - Simply set an environment variable or add a folder

## How It Works

1. Agent starts session on project
2. Agent delegates to ObservabilityAgent for initialization
3. ObservabilityAgent detects project observability via:
   - `OBSERVABILITY_ENABLED=true` in project's `.env` (OR)
   - `/observability/` folder exists in project
4. Project's `./observability/instrumentation.mjs` is dynamically loaded
5. Project's Langfuse credentials are used for tracing

## Enabling Project Observability

### Option 1: Environment Flag (Recommended)

Add to your project's `.env`:

```bash
# Langfuse Observability
OBSERVABILITY_ENABLED=true
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### Option 2: Observability Folder

Create an `/observability/` folder in your project:

```
my-project/
├── observability/
│   ├── instrumentation.mjs    # Required - SDK initialization
│   ├── session.mjs           # Optional - Session wrapper
│   └── test.mjs              # Optional - Test script
├── src/
└── ...
```

The presence of this folder is automatically detected.

## Required Files

### instrumentation.mjs

This file initializes the observability SDK. Must be the first import:

```javascript
/**
 * Observability Instrumentation
 * 
 * Initialize Langfuse + OpenTelemetry as the FIRST import.
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const isEnabled = process.env.OBSERVABILITY_ENABLED === "true";

let langfuseSpanProcessor = null;

if (isEnabled) {
  langfuseSpanProcessor = new LangfuseSpanProcessor({
    exportMode: "immediate",
  });

  const observabilitySDK = new NodeSDK({
    spanProcessors: [langfuseSpanProcessor],
  });

  observabilitySDK.start();
} else {
  // Dummy processor for when disabled
  langfuseSpanProcessor = {
    forceFlush: async () => {},
    onEnd: () => {},
    onStart: () => {},
  };
}

export { langfuseSpanProcessor };

if (isEnabled) {
  console.log("✅ Observability initialized");
}
```

### session.mjs (Optional)

Session wrapper for easier tracing:

```javascript
import { startActiveObservation, propagateAttributes } from "@langfuse/tracing";
import { langfuseSpanProcessor } from "./instrumentation.mjs";

export function isObservabilityEnabled() {
  return process.env.OBSERVABILITY_ENABLED === "true";
}

export async function startSession(context) {
  if (!isObservabilityEnabled()) return;
  
  // ... implementation
}

export async function recordTool({ tool, success, latencyMs }) {
  if (!isObservabilityEnabled()) return;
  
  // ... implementation
}

export async function endSession() {
  if (!isObservabilityEnabled()) return;
  
  await langfuseSpanProcessor.forceFlush();
}
```

## Example: rowell-ai Project

The rowell-ai project has observability enabled:

```
/Users/tara/workspace/rowell-ai/
├── observability/
│   ├── instrumentation.mjs    # Conditional initialization
│   ├── session.mjs            # Session wrapper with enable check
│   └── test.mjs               # Test script
├── .env                       # Has OBSERVABILITY_ENABLED=false
└── ...
```

To enable:

```bash
# Enable tracing
echo "OBSERVABILITY_ENABLED=true" >> .env

# Or just rely on the folder detection
# (the folder already exists)
```

## Agent Integration

When OpenAgent, OpenCoder, or SystemBuilder works on a project:

1. **Session Start** - Agent calls ObservabilityAgent with `projectPath`
2. **Detection** - ObservabilityAgent checks for:
   - `OBSERVABILITY_ENABLED=true` in `.env`
   - `/observability/` folder exists
3. **Loading** - Project's `instrumentation.mjs` is dynamically imported
4. **Tracing** - All agent actions are traced using project's credentials

### Agent Configuration

Agents are configured to pass `projectPath` during initialization:

```yaml
# In agent prompt (openagent.md, opencoder.md, system-builder.md)
Initialize observability at session start:
- Delegate to ObservabilityAgent subagent for initialization
- Use task tool: {
    "subagent": "observability", 
    "action": "initialize", 
    "sessionId": "<current_session>", 
    "projectPath": "<current_working_directory>"
  }
```

## Testing

### Test Detection

```typescript
import { detectProjectObservability } from "./observability/collectors/session-collector.ts";

const projectPath = "/path/to/your/project";
const detected = detectProjectObservability(projectPath);
console.log("Detected:", detected);
```

### Test Full Flow

```bash
# Run the e2e test script
npx tsx .opencode/scripts/test-e2e-observability.ts
```

### Test Project Observability Directly

```bash
# From project directory with OBSERVABILITY_ENABLED=true
node observability/test.mjs
```

## Troubleshooting

### Traces Not Appearing

1. Check `OBSERVABILITY_ENABLED=true` in `.env`
2. Verify Langfuse keys are correct
3. Check console for initialization messages
4. Verify network connectivity to Langfuse

### Detection Not Working

1. Verify `.env` file exists and is readable
2. Check for typos: `OBSERVABILITY_ENABLED` (exact spelling)
3. Ensure `/observability/` folder exists (if using folder method)
4. Check console logs for detection messages

### Module Not Loading

1. Verify `instrumentation.mjs` exists in `/observability/` folder
2. Check file permissions
3. Ensure it's valid ESM module

## API Reference

### Session Collector Exports

```typescript
// Detection
detectProjectObservability(projectPath: string): string | null

// Loading
loadProjectObservability(projectPath: string): Promise<boolean>
isProjectObservabilityLoaded(): boolean
getProjectObservabilityPath(): string | null

// Session management
startSession(context: SessionContext): Promise<void>
recordToolCall(toolName: string, success: boolean, latencyMs?: number, metadata?: object): Promise<void>
endSession(): Promise<void>
```

### ObservabilityAgent Actions

```typescript
// Initialize with project path
{ action: "initialize", sessionId: "...", projectPath: "..." }

// Detect project observability
{ action: "detect_project", projectPath: "..." }

// Send trace
{ action: "send_trace", traceData: {...} }

// Check status
{ action: "status" }

// Test connection
{ action: "test_connection" }
```

## Best Practices

1. **Use `.env.example`** - Document required variables
2. **Default to disabled** - Set `OBSERVABILITY_ENABLED=false` initially
3. **Test locally** - Use test script before enabling in production
4. **Use sessionId** - Link traces to agent sessions for better debugging
5. **Check Langfuse dashboard** - Verify traces appear after enabling

## Related Documentation

- [Setup Langfuse](./setup-langfuse.md) - Full Langfuse setup guide
- [Observability Plan](./observeability-plan.md) - Architecture overview
- [Auto-Instrumentation](../observability/hooks/auto-instrument.ts) - Tool/LLM/Agent wrappers
