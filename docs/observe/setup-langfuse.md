# Langfuse Setup for OpenAgents Control

## File Structure

```
.opencode/observability/
├── instrumentation.ts        # Main SDK initialization (import first!)
├── instrumentation.mjs       # ESM version for scripts
├── trace-context.ts          # Rich trace metadata (agent/task/user/build context)
├── config/
│   └── observability.config.ts  # Configuration loader
├── collectors/
│   ├── session-collector.ts    # Session tracing with sessionId linking
│   ├── model-collector.ts      # Model metrics and pricing
│   ├── tool-collector.ts      # Tool execution metrics
│   └── cost-collector.ts      # Cost tracking per model
├── hooks/
│   ├── model-detector.ts      # Auto model detection from API headers
│   ├── auto-instrument.ts     # instrumentedTool/LLM/Agent wrappers
│   └── index.ts              # Barrel exports
└── scripts/
    ├── test-langfuse.mjs      # Basic Langfuse test
    ├── test-collectors.ts     # Collectors integration test
    ├── test-auto-instrument.ts # Full auto-instrumentation test
    └── test-rich-context.ts   # Rich context test with full metadata
```

## Prerequisites

- Node.js >= 18.0.0
- A Langfuse account (cloud or self-hosted)

## Installation

### 1. Install Dependencies

Langfuse is already included as a dependency in this project:

```bash
npm install
```

### 2. Install CLI (Optional but Recommended)

The `langfuse-cli` package provides useful commands for interacting with Langfuse:

```bash
npm run langfuse -- --help
```

Available commands:
- `npm run langfuse -- api traces list` - List traces
- `npm run langfuse -- api prompts list` - List prompts
- `npm run langfuse -- api scores create` - Create scores

## Environment Variables

Create or update your `.env` file:

```bash
cp .env.example .env
# Then edit .env with your real keys
```

**Example `.env` content:**

```env
LANGFUSE_PUBLIC_KEY=pk-lf-your-actual-public-key
LANGFUSE_SECRET_KEY=sk-lf-your-actual-secret-key
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com  # For US region
# LANGFUSE_BASE_URL=https://cloud.langfuse.com  # For EU region
OBSERVABILITY_ENABLED=true
```

**Important**: 
- Get real keys from: https://cloud.langfuse.com/project/_/settings/api-keys
- ⚠️ **Use the correct base URL for your region:**
  - US users: `https://us.cloud.langfuse.com`
  - EU users: `https://cloud.langfuse.com`
- Never commit `.env` to git (it's in `.gitignore`)
- Restart your terminal or run `source .env` after editing

## Quick Start

1. **Set your Langfuse API keys** (from Langfuse dashboard → Settings → API Keys)
2. **Run the test**:

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-your-key LANGFUSE_SECRET_KEY=sk-lf-your-key LANGFUSE_BASE_URL=https://us.cloud.langfuse.com node .opencode/scripts/test-langfuse.mjs
```

3. **Verify your traces** in the Langfuse dashboard (see below).

### Human Verification Test

After running the test script, verify traces appear in your dashboard.

⚠️ **Important**: Use the same base URL you used when running the test. If you used `LANGFUSE_BASE_URL=https://us.cloud.langfuse.com`, query `us.cloud.langfuse.com`. If you used the default (EU), query `cloud.langfuse.com`.

**Step 1**: Query the traces API (use YOUR base URL):

```bash
# For US region:
curl -s -u "pk-lf-your-key:sk-lf-your-key" \
  "https://us.cloud.langfuse.com/api/public/traces?limit=1" | jq '{name: .data[0].name, id: .data[0].id, timestamp: .data[0].timestamp}'

# For EU region:
curl -s -u "pk-lf-your-key:sk-lf-your-key" \
  "https://cloud.langfuse.com/api/public/traces?limit=1" | jq '{name: .data[0].name, id: .data[0].id, timestamp: .data[0].timestamp}'
```

**Step 2**: Open your dashboard (use YOUR base URL):
- US region: https://us.cloud.langfuse.com
- EU region: https://cloud.langfuse.com
- Look for a trace named `openagents-control-test`
- Or search by the trace ID from Step 1

**Expected result**: A trace with name `openagents-control-test` should appear (may take 1-2 minutes).

### Example Verification Session

```bash
# 1. Run the test (using US region)
$ LANGFUSE_PUBLIC_KEY=pk-lf-xxx LANGFUSE_SECRET_KEY=sk-lf-xxx LANGFUSE_BASE_URL=https://us.cloud.langfuse.com node .opencode/scripts/test-langfuse.mjs

✅ Langfuse OpenTelemetry initialized
🧪 Testing Langfuse + OpenTelemetry integration...
✅ Trace created successfully
🎉 Test completed and data sent to Langfuse

# 2. Check for traces (wait ~1-2 minutes) - NOTE: same base URL!
$ curl -s -u "pk-lf-xxx:sk-lf-xxx" "https://us.cloud.langfuse.com/api/public/traces?limit=1" | jq '{name: .data[0].name, id: .data[0].id}'
{
  "name": "openagents-control-test",
  "id": "abc123def456..."
}

# 3. View in dashboard
# Open: https://us.cloud.langfuse.com
```

## ⚠️ Important: Async Processing Delay

**Traces may take 1-2 minutes to appear in the dashboard!**

Langfuse uses async server-side processing for OTLP traces:
```
Application → SDK (buffered) → Background exporter → Langfuse backend → Dashboard
```

This is normal behavior, not a bug. The SDK sends traces immediately, but they enter a processing queue on the server side.

To verify traces are being sent, use the CLI:

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-xxx LANGFUSE_SECRET_KEY=sk-lf-xxx \
  npm run langfuse -- api traces list
```

If traces show in the API response, they're working - just waiting for the async queue.

## Configuration

The system loads configuration in this order:

1. Environment variables (`LANGFUSE_*`)
2. `.config/oac/observability.json`
3. `.opencode/observability.json`

## Instrumentation Setup

The observability system uses OpenTelemetry with Langfuse Span Processor:

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  exportMode: "immediate",  // Required for CLI scripts
});

export const observabilitySDK = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor],
});
```

**Important**: Import the instrumentation file at the very top of your application entry point.

## Using with Agents

The `OpenAgent` automatically initializes observability at session start by calling the `ObservabilityAgent`.

You can manually test the connection:

```bash
# Test connection
node -e '
  import("./.opencode/agent/subagents/observability/observability-agent.ts")
    .then(m => m.testObservabilityConnection())
    .then(console.log);
'
```

## Collectors

The observability system includes collectors for session and model metrics:

### Session Linking

Sessions are automatically linked to traces using Langfuse's session feature. When you call `startSession()`, all subsequent traces within that session are automatically linked.

```typescript
import { startSession } from './observability/collectors/session-collector.ts';

// Start a session - this creates a session in Langfuse
await startSession({
  sessionId: 'my-session-123',
  userId: 'user@example.com',
  agentName: 'openagent'
});

// All traces after this point are automatically linked to this session
```

**Viewing session-linked traces:**
1. Go to Langfuse dashboard → Sessions view
2. Find your session by ID
3. Click to see all linked traces

**API verification:**
```bash
curl -s -u "pk-lf-xxx:sk-lf-xxx" \
  "https://us.cloud.langfuse.com/api/public/sessions?limit=10"
```

### Trace Context

All traces automatically capture rich context for meaningful observability:

#### Agent Context
| Field | Description |
|-------|-------------|
| `agent.name` | Name of the agent (e.g., "openagent", "task-manager") |
| `agent.type` | Type of agent (e.g., "agent", "subagent", "orchestrator") |
| `agent.version` | Agent version from package.json |

#### Task Context
| Field | Description |
|-------|-------------|
| `task.id` | Unique task identifier |
| `task.goal` | Goal/objective of the current task |
| `task.workflowId` | Parent workflow ID (if applicable) |
| `task.constraints` | List of constraints for the task |

#### User Context
| Field | Description |
|-------|-------------|
| `user.message` | Original user message (truncated to 500 chars) |
| `user.turnNumber` | Conversation turn number |
| `user.sessionType` | Type of session ("oac-session") |

#### Build Context
| Field | Description |
|-------|-------------|
| `build.gitHash` | Git commit hash (short, 8 chars) |
| `build.gitBranch` | Current git branch |
| `build.gitTag` | Git tag (if any) |
| `build.commitMessage` | Latest commit message |
| `build.version` | Version from package.json |
| `build.buildTime` | ISO timestamp of build context capture |

#### System Context
| Field | Description |
|-------|-------------|
| `system.hostname` | Machine hostname |
| `system.platform` | OS platform (darwin, linux, win32) |
| `system.arch` | CPU architecture |
| `system.nodeVersion` | Node.js version |
| `system.cwd` | Current working directory |

#### Enhanced Error Details
On failures, traces capture:
| Field | Description |
|-------|-------------|
| `error.message` | Error message |
| `error.name` | Error name (e.g., "TypeError", "ReferenceError") |
| `error.stack` | **Full stack trace** for debugging |
| `error.code` | Error code (if applicable) |

**Example usage:**
```typescript
import { startSession } from './observability/collectors/session-collector.ts';

await startSession({
  sessionId: 'my-session-123',
  userId: 'user@example.com',
  agentName: 'openagent',
  agentType: 'orchestrator',
  agentVersion: '1.2.0',
  task: {
    goal: 'Implement user authentication',
    taskId: 'task-456',
    constraints: ['use OAuth2', 'support Google login'],
  },
  userMessage: 'Please add authentication to the app',
  turnNumber: 3,
});
```

### Session Collector

Track session-level events:

```typescript
import { startSession, recordToolCall, recordInference, endSession } from './observability/collectors/session-collector.ts';

// Start a session
await startSession({
  sessionId: 'my-session-123',
  userId: 'user@example.com',
  agentName: 'openagent'
});

// Record tool calls
await recordToolCall('read', true, 150);  // toolName, success, latencyMs
await recordToolCall('bash', false, 500, { error: 'Permission denied' });

// Record LLM inference
await recordInference('claude-3-5-sonnet-20241022', 500, 150, 1200);

// End session and get metrics
const metrics = await endSession();
console.log(`Session complete: ${metrics.toolCount} tools, ${metrics.successRate}% success`);
```

### Model Collector

Track model performance and costs:

```typescript
import { recordInference, getModelSummary, formatCost } from './observability/collectors/model-collector.ts';

// Record inference
recordInference({
  model: 'claude-3-5-sonnet-20241022',
  inputTokens: 1000,
  outputTokens: 500,
  latencyMs: 1500,
  cost: 0.0225
});

// Get summary
const summary = getModelSummary();
console.log(`Total cost: ${formatCost(summary.totalCost)}`);
```

### Test Collectors

Run the collectors test script:

```bash
npx tsx .opencode/scripts/test-collectors.ts
```

This demonstrates both session and model collection with sample data.

## Auto-Instrumentation Hooks

For easier tracing integration, use the auto-instrumentation hooks:

### Quick Start

```typescript
import { instrumentedTool, instrumentedLLM, instrumentedAgent } from './observability/hooks/auto-instrument.ts';

// Instrument a tool call
const result = await instrumentedTool('Read', { path: 'file.txt' }, 
  () => fs.readFile('file.txt')
);

// Instrument an LLM call (model detected automatically)
const response = await instrumentedLLM(
  { messages: [{ role: 'user', content: 'Hello' }] },
  (config) => openai.chat.completions.create(config)
);

// Instrument an agent task
const result = await instrumentedAgent('code-review', { repo: 'my-app' },
  async (span) => {
    span.update({ status: 'analyzing' });
    return await runAnalysis();
  }
);

// Create custom spans manually
import { createSpan } from './observability/hooks/auto-instrument.ts';

await createSpan('custom-operation', async (span) => {
  span.update({ input: { step: 1 } });
  const result = await doSomething();
  span.update({ output: { result } });
  return result;
});
```

### Model Detection

The hooks automatically detect the model used:

1. **API response headers** (most accurate) - e.g., `x-anthropic-model`
2. **Environment variable** (`CURRENT_MODEL`)
3. **Manual override** (via config parameter)

```typescript
// Set model for subsequent calls
import { setCurrentModel } from './observability/hooks/auto-instrument.ts';

setCurrentModel('claude-3-5-sonnet-20241022');
```

#### Model Detector Functions

The `model-detector.ts` module provides fine-grained model detection:

```typescript
import {
  getCurrentModel,
  setCurrentModel,
  detectFromHeaders,
  extractProvider,
  type ModelInfo,
} from './observability/hooks/model-detector.ts';

// Get current model info
const model = getCurrentModel();
console.log(`${model.model} (from ${model.detectedFrom})`);

// Detect from response headers
const modelName = detectFromHeaders({
  'x-anthropic-model': 'claude-3-5-sonnet-20241022',
});
// Returns: 'claude-3-5-sonnet-20241022'

// Extract provider from model name
const provider = extractProvider('claude-3-5-sonnet-20241022');
// Returns: 'anthropic'
```

**Supported headers:**
- `x-anthropic-model` (Anthropic)
- `x-goog-api-model` (Google)
- `openai-model` / `x-openai-model` (OpenAI)

### Tool Collector

Track tool execution metrics:

```typescript
import { recordTool, getToolSummary, getAllToolMetrics } from './observability/collectors/tool-collector.ts';

recordTool('Read', true, 150);  // name, success, latencyMs
recordTool('Bash', false, 500, 'Permission denied');

const summary = getToolSummary();
console.log(`${summary.totalInvocations} calls, ${summary.avgSuccessRate}% success`);
```

### Cost Collector

Track costs and link to traces:

```typescript
import { recordCost, getCostSummary, formatCurrency } from './observability/collectors/cost-collector.ts';

recordCost('claude-3-5-sonnet-20241022', 1000, 500);

const summary = getCostSummary();
console.log(`Total: ${formatCurrency(summary.totalCost)}`);
```

### Test Auto-Instrumentation

Run the auto-instrumentation test:

```bash
npx tsx .opencode/scripts/test-auto-instrument.ts
```

This comprehensive test demonstrates:
- Session creation with sessionId linking
- Model detection from headers
- Tool instrumentation with success/failure tracking
- LLM call instrumentation with cost calculation
- Cost and tool summary reporting

### Test Rich Context

Run the rich context test to verify all metadata is captured:

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-xxx LANGFUSE_SECRET_KEY=sk-lf-xxx \
  LANGFUSE_BASE_URL=https://us.cloud.langfuse.com \
  npx tsx .opencode/scripts/test-rich-context.ts
```

This test sends traces with full context including:
- Build info (git hash, branch, version)
- System info (hostname, platform, node version)
- Agent/task/user context
- Error spans with full stack traces

After running, filter by the session ID shown in output to verify metadata in the Langfuse dashboard.

## CLI Commands Reference

```bash
# List traces
npm run langfuse -- api traces list --limit 10

# List prompts
npm run langfuse -- api prompts list

# Create a score
npm run langfuse -- api scores create --name quality --traceId <id> --value 0.9

# View project schema
npm run langfuse -- api __schema
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **No traces appearing** | Wait 1-2 minutes - it's async processing |
| **API returns empty list** | Check if `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are set |
| **Invalid credentials** | Verify keys from Langfuse dashboard are correct |
| **Permission errors** | Make sure the keys have write access to the project |
| **Traces not appearing after 5+ min** | Check network connectivity, verify LANGFUSE_BASE_URL |
| **Traces sent but API returns null** | ⚠️ You're querying the wrong region endpoint! If you set `LANGFUSE_BASE_URL=https://us.cloud.langfuse.com`, you must query `us.cloud.langfuse.com`, not `cloud.langfuse.com` |

### Debug Mode

Enable debug logging to see SDK activity:

```bash
LANGFUSE_LOG_LEVEL=DEBUG node .opencode/scripts/test-langfuse.mjs
```

### Verify API Access

Test your credentials directly (⚠️ use the same region you used in LANGFUSE_BASE_URL):

```bash
# For US region:
curl -u "pk-lf-xxx:sk-lf-xxx" \
  "https://us.cloud.langfuse.com/api/public/traces?limit=1"

# For EU region:
curl -u "pk-lf-xxx:sk-lf-xxx" \
  "https://cloud.langfuse.com/api/public/traces?limit=1"
```

Should return trace data if credentials are valid.

## See Also

- Full Langfuse documentation: https://langfuse.com/docs/observability/get-started
- SDK troubleshooting: https://langfuse.com/docs/observability/sdk/troubleshooting-and-faq
- OpenTelemetry setup: https://langfuse.com/docs/observability/sdk/instrumentation
- [Project-Specific Observability](./project-observability.md) - Enable per-project tracing
