# **OpenAgents Control \- TypeScript-Native Observability Implementation Plan**

## **With Multi-Project Cloud UI Solution**

---

---

## **Executive Summary**

Implement a **lightweight TypeScript-native observability system** for OpenAgents Control that:

* ✅ Builds on existing session storage (95.3% tool success rate baseline)
* ✅ Uses OpenTelemetry standard (vendor-agnostic)
* ✅ Supports multiple OAC projects in unified dashboard
* ✅ Provides production-ready cloud UI (no custom UI development needed)
* ✅ Maintains OAC's minimal-dependency philosophy

---

---

## **🎯 Recommended Architecture**

### **Primary Recommendation: Langfuse (Open Source \+ Cloud)**

**Why Langfuse?**

1. **✅ LLM-Native:** Purpose-built for AI/LLM observability (not generic APM)
2. **✅ TypeScript SDK:** First-class TypeScript support with full typing
3. **✅ Multi-Project Support:** Built-in project organization and switching
4. **✅ Open Source \+ Cloud:** Self-host OR use cloud (MIT license)
5. **✅ Cost-Effective:** Free tier for development, cloud pricing transparent
6. **✅ Recently Acquired by ClickHouse:** Strong future (Jan 2026 acquisition)
7. **✅ OpenTelemetry Compatible:** Export to other backends if needed

**Alternative Options:**

* **Axiom:** Best if you want petabyte-scale logs \+ observability ($99/mo for 5TB)
* **Grafana Cloud:** Best if you already use Grafana stack (free tier available)
* **Self-Hosted Only:** Use OpenTelemetry \+ local JSON exports (no UI dev needed)

---

---

## **📦 Dependencies & Third-Party Integrations**

### **Core Dependencies (Minimal)**

{  
"dependencies": {  
"@opentelemetry/api": "^1.9.0",              // \~9KB, API only (required)  
"@opentelemetry/sdk-node": "^0.54.0",        // \~500KB, SDK (required)  
"@opentelemetry/resources": "^1.28.0",       // Resource attributes  
"@opentelemetry/semantic-conventions": "^1.28.0", // Standard naming  
"langfuse": "^3.30.0"                        // \~200KB, Langfuse TypeScript SDK  
},  
"devDependencies": {  
"@opentelemetry/sdk-trace-node": "^1.28.0",  // Tracing (dev/test)  
"@opentelemetry/sdk-metrics": "^1.28.0"      // Metrics (dev/test)  
}  
}

**Total Added Size:** \~700KB compressed (\~2MB uncompressed) **Performance Impact:** \<5ms overhead per operation when enabled, zero when disabled

### **Optional Dependencies (Based on Configuration)**

{  
"optionalDependencies": {  
"@opentelemetry/exporter-trace-otlp-http": "^0.54.0",  // Axiom/Grafana/generic OTLP  
"@opentelemetry/exporter-metrics-otlp-http": "^0.54.0",  
"@axiomhq/js": "^1.0.0",                               // Axiom-specific (if chosen)  
"@grafana/faro-web-sdk": "^1.10.0"                     // Grafana Faro (if chosen)  
}  
}
---

---

## **🏗️ Implementation Architecture**

### **Directory Structure**

.opencode/observability/  
├── core/  
│   ├── tracer.ts                    \# OpenTelemetry tracer initialization  
│   ├── metrics.ts                   \# Metrics collectors  
│   ├── context.ts                   \# Context propagation  
│   ├── attributes.ts                \# Standard attribute definitions  
│   └── types.ts                     \# TypeScript types  
├── providers/  
│   ├── langfuse-provider.ts         \# Langfuse integration (PRIMARY)  
│   ├── axiom-provider.ts            \# Axiom integration (OPTIONAL)  
│   ├── otlp-provider.ts             \# Generic OTLP (Grafana/others)  
│   └── json-provider.ts             \# Local JSON export (self-hosted)  
├── collectors/  
│   ├── session-collector.ts         \# Extend OAC session storage  
│   ├── agent-collector.ts           \# Agent-level metrics  
│   ├── model-collector.ts           \# Model performance tracking  
│   ├── tool-collector.ts            \# Tool execution tracing  
│   └── cost-collector.ts            \# Cost analysis  
├── instrumentation/  
│   ├── auto-instrument.ts           \# Auto-instrument OAC components  
│   ├── agent-instrument.ts          \# Agent execution spans  
│   ├── tool-instrument.ts           \# Tool call tracing  
│   └── session-instrument.ts        \# Session lifecycle  
├── config/  
│   ├── observability.config.ts      \# Configuration loader  
│   ├── observability.schema.ts      \# Zod schema for validation  
│   └── examples/                    \# Example configs  
│       ├── langfuse.config.json     \# Langfuse setup  
│       ├── axiom.config.json        \# Axiom setup  
│       ├── grafana.config.json      \# Grafana Cloud setup  
│       └── self-hosted.config.json  \# Local-only  
├── cli/  
│   ├── observe.ts                   \# CLI commands  
│   └── commands/  
│       ├── session.ts               \# View session trace  
│       ├── agent.ts                 \# Agent analytics  
│       ├── cost.ts                  \# Cost reports  
│       └── export.ts                \# Export data  
├── index.ts                         \# Public API  
└── README.md                        \# Documentation

docs/observability/  
├── README.md                        \# Quick start guide  
├── setup-langfuse.md               \# Langfuse setup (PRIMARY)  
├── setup-axiom.md                  \# Axiom setup  
├── setup-grafana.md                \# Grafana setup  
├── setup-self-hosted.md            \# Self-hosted guide  
├── multi-project-config.md         \# Managing multiple OAC projects  
├── cost-optimization.md            \# Using observability for savings  
└── troubleshooting.md              \# Common issues
---

---

## **🔧 Configuration System**

### **Multi-Project Configuration**

**Global Config:** `~/.config/oac/observability.json`

{  
"provider": "langfuse",           // langfuse | axiom | otlp | json  
"enabled": true,  
"level": "detailed",              // basic | detailed | full  
"sampling": 1.0,                  // 1.0 \= 100% traces

"langfuse": {  
"publicKey": "pk-lf-xxx",  
"secretKey": "sk-lf-xxx",  
"baseUrl": "https://cloud.langfuse.com",  // or self-hosted URL  
"projects": {  
"oac-core": "project-id-1",  
"oac-evals": "project-id-2",  
"my-app": "project-id-3"  
}  
},

"attributes": {  
"service.name": "openagents-control",  
"service.version": "0.7.1",  
"deployment.environment": "production",  
"team.name": "your-team"  
},

"sampling": {  
"default": 1.0,  
"byAgent": {  
"build": 0.1,               // Sample 10% of build agent  
"openagent": 1.0            // Sample 100% of openagent  
},  
"byModel": {  
"sonic": 0.05,              // Low sample for free model  
"claude-sonnet-4": 1.0      // Full sample for expensive model  
}  
},

"exporters": {  
"console": {  
"enabled": true,  
"level": "info"             // debug | info | warn | error  
},  
"json": {  
"enabled": true,  
"path": "\~/.local/share/oac/observability",  
"maxFiles": 100,  
"maxSizeMB": 500  
}  
}  
}

**Project-Level Config:** `.opencode/observability.json` (optional override)

{  
"projectId": "oac-core",  
"projectName": "OpenAgents Control Core",  
"langfuse": {  
"project": "project-id-1",  
"tags": \["core", "production"\],  
"metadata": {  
"repository": "github.com/darrenhinde/OpenAgentsControl",  
"branch": "main"  
}  
}  
}
---

---

## **📊 Observability Features**

### **What Gets Tracked**

#### **1\. Agent Execution Traces**

// Automatic span creation  
Span: agent:openagent:execute  
├─ Span: context:load (timing: context loading)  
├─ Span: llm:inference (timing: model response)  
│   └─ Attributes: model=claude-sonnet-4, tokens\_in=936, tokens\_out=81, cost=0.00  
├─ Span: tool:read (timing: file read)  
├─ Span: approval:wait (timing: user approval time)  
└─ Span: tool:write (timing: file write)

#### **2\. Metrics Collected**

// Counters  
agent.executions.total (by agent, model, status)  
tool.calls.total (by tool, status)  
approval.requests.total (by agent)  
delegation.total (from\_agent, to\_agent)

// Gauges  
agent.active.sessions  
token.usage.current\_rate

// Histograms (p50, p95, p99)  
agent.duration\_ms (by agent, model)  
tool.latency\_ms (by tool)  
llm.inference\_ms (by model, provider)  
approval.wait\_time\_ms  
cost.per\_session (by agent, model)

#### **3\. Cost Tracking**

* Real-time cost accumulation per session
* Model-specific pricing (Claude 0.107/msg, Gemini0.030/msg, Sonic $0.00)
* Cache savings tracking (99.9% hit rate \= $2.95/100 messages)
* Budget alerts and recommendations

#### **4\. Error Tracking**

* Tool failures with full context
* Model errors (rate limits, timeouts)
* Agent crashes with stack traces
* Cost anomalies (unexpected spikes)

---

---

## **🎨 UI Solution: Langfuse Dashboard**

### **What You Get (No Custom Development)**

#### **Multi-Project View**

Langfuse Dashboard  
├── Projects Dropdown  
│   ├── OAC Core (project-id-1)  
│   ├── OAC Evals (project-id-2)  
│   └── My App (project-id-3)  
│  
├── Traces Tab  
│   └── View all agent executions  
│       ├── Timeline visualization  
│       ├── Span waterfall (tool calls)  
│       ├── Token usage per trace  
│       └── Cost breakdown  
│  
├── Sessions Tab  
│   └── Group traces by OAC session  
│       ├── Multi-turn conversations  
│       ├── Agent switching tracking  
│       └── Total session cost  
│  
├── Metrics Tab  
│   └── Real-time dashboards  
│       ├── Success/failure rates  
│       ├── Latency percentiles (p50, p95, p99)  
│       ├── Token usage trends  
│       └── Cost over time  
│  
├── Evaluations Tab  
│   └── Link with OAC eval framework  
│       ├── Test results  
│       ├── Performance benchmarks  
│       └── Model comparisons  
│  
└── Playground Tab  
└── Test prompts with observability

### **Langfuse Features for OAC**

| Feature | Benefit for OAC |
| ----- | ----- |
| **Multi-Project Support** | Monitor multiple OAC installations in one dashboard |
| **Trace Visualization** | See complete agent execution flow (context → LLM → tools) |
| **Cost Tracking** | Real-time cost per agent/model/session |
| **Session Grouping** | Group multi-turn OAC conversations |
| **Prompt Management** | Version and compare agent prompts |
| **Evaluations** | Link with OAC's eval framework results |
| **Team Collaboration** | Share traces, add comments, create issues |
| **API \+ SDK** | Programmatic access for custom analytics |
| **Self-Hosted Option** | Deploy in your VPC or on-premises |

---

---

## **💰 Pricing Analysis**

### **Langfuse Pricing (RECOMMENDED)**

| Tier | Price | Traces/Month | Features | Best For |
| ----- | ----- | ----- | ----- | ----- |
| **Hobby** | **$0** | 50K traces | Basic observability, 30-day retention | Development, small projects |
| **Pro** | **$59/mo** | 500K traces | Advanced features, 90-day retention, SSO | Growing teams, multiple projects |
| **Team** | **$299/mo** | 5M traces | Unlimited projects, 180-day retention | Production teams |
| **Enterprise** | **Custom** | Unlimited | On-prem, custom retention, SLA | Large organizations |
| **Self-Hosted** | **$0** | Unlimited | MIT license, your infrastructure | Full control, high security |

**Example Cost Estimate:**

* **OAC Development (you):** Hobby tier \= **$0/mo** (50K traces ≈ 1,600 agent sessions)
* **Small Team (5 devs):** Pro tier \= **$59/mo** (500K traces ≈ 16,000 sessions)
* **Self-Hosted:** 0 software \+ infrastructure (\~50-200/mo for modest cloud VM)

### **Alternative Pricing**

| Provider | Free Tier | Paid Tier | Multi-Project | Self-Hosted |
| ----- | ----- | ----- | ----- | ----- |
| **Langfuse** | 50K traces | $59/mo (500K) | ✅ Built-in | ✅ MIT license |
| **Axiom** | 0.5TB storage | $99/mo (5TB) | ✅ Datasets | ❌ Cloud only |
| **Grafana Cloud** | Limited | $19/mo \+ usage | ✅ Orgs/folders | ✅ OSS available |
| **LangSmith** | 5K traces | $39/mo (50K) | ⚠️ Limited | ❌ Cloud only |
| **Honeycomb** | 20M events | $130/mo (100M) | ✅ Environments | ❌ Cloud only |
| **Self-Hosted JSON** | Free | Free | ⚠️ Manual | ✅ Fully local |

---

---

## **🚀 Implementation Phases**

### **Phase 1: Core Infrastructure (Week 1, 3-4 days)**

**Deliverables:**

* OpenTelemetry tracer initialization
* Langfuse provider integration
* Configuration system with validation
* Basic instrumentation (agent execution, tool calls)

**Files Created:**

.opencode/observability/  
├── core/tracer.ts  
├── core/attributes.ts  
├── providers/langfuse-provider.ts  
├── config/observability.config.ts  
└── index.ts

**Testing:**

\# Set up Langfuse (cloud or self-hosted)  
npm run observe:init

\# Run test with observability  
LANGFUSE\_PUBLIC\_KEY=pk-xxx LANGFUSE\_SECRET\_KEY=sk-xxx npm run test:openagent

\# View in Langfuse dashboard  
open https://cloud.langfuse.com

### **Phase 2: Enhanced Collectors (Week 1, 2-3 days)**

**Deliverables:**

* Session-level tracing (link to OAC session storage)
* Model performance metrics
* Cost tracking with cache savings
* Tool latency collection

**Files Created:**

.opencode/observability/  
├── collectors/session-collector.ts  
├── collectors/model-collector.ts  
├── collectors/tool-collector.ts  
└── collectors/cost-collector.ts

### **Phase 3: Auto-Instrumentation (Week 2, 2-3 days)**

**Deliverables:**

* Automatic agent execution tracing
* Tool call instrumentation
* Approval gate timing
* Context loading performance

**Files Created:**

.opencode/observability/  
├── instrumentation/auto-instrument.ts  
├── instrumentation/agent-instrument.ts  
└── instrumentation/tool-instrument.ts

### **Phase 4: Multi-Project Support (Week 2, 2 days)**

**Deliverables:**

* Global configuration management
* Project-level overrides
* Automatic project detection
* CLI commands for project switching

**Files Created:**

.opencode/observability/  
├── config/project-manager.ts  
└── cli/observe.ts

**CLI Commands:**

\# List configured projects  
oac observe projects

\# View project traces  
oac observe traces \--project oac-core

\# Compare model performance across projects  
oac observe models \--compare \--projects oac-core,my-app

\# Export traces for offline analysis  
oac observe export \--project oac-core \--format json

### **Phase 5: Documentation & Examples (Week 3, 2-3 days)**

**Deliverables:**

* Complete setup guides for Langfuse, Axiom, Grafana
* Multi-project configuration examples
* Cost optimization guide
* Troubleshooting documentation

**Files Created:**

docs/observability/  
├── README.md  
├── setup-langfuse.md  
├── multi-project-config.md  
└── cost-optimization.md
---

---

## **📈 Success Metrics & Validation**

After implementation, you should be able to answer:

### **Performance Questions**

* ✅ Which agent+model pairs have lowest latency? (Target: \<10s for complex, \<3s for simple)
* ✅ What's the p95 latency for each tool? (Identify slow tools)
* ✅ Which models have best cache hit rates? (Target: \>90% for Claude)

### **Cost Questions**

* ✅ What's total spend per project per month? (Budget tracking)
* ✅ Which model provides best cost/performance ratio? (Claude vs Gemini vs Sonic)
* ✅ How much are cache hits saving? (Target: $2.95/100 messages for Claude)

### **Reliability Questions**

* ✅ Which tools have highest error rates? (Current baseline: 4.7% errors)
* ✅ Which agents require most approval interventions? (Identify problematic agents)
* ✅ What's the success rate by model/agent? (Quality tracking)

### **Efficiency Questions**

* ✅ How long do approval gates delay execution? (User experience metric)
* ✅ Is context loading optimized? (Should be \<1s)
* ✅ Are we hitting token limits? (Identify oversized contexts)

---

---

## **🔐 Security & Privacy**

### **Data Handling**

* **Traces:** Contain agent names, tool names, timing, costs (NO sensitive user data)
* **Metrics:** Aggregate counters and histograms (NO PII)
* **Spans:** Execution flow, no file contents or credentials
* **Costs:** Model pricing only, no payment info

### **Sensitive Data Exclusion**

// Automatically scrubbed before export  
const EXCLUDED\_ATTRIBUTES \= \[  
'api\_key', 'secret', 'password', 'token',  
'file.content',      // File contents not traced  
'user.email',        // User info not traced  
'credential.\*'       // Credentials never exported  
\];

### **Configuration Options**

{  
"privacy": {  
"scrubApiKeys": true,          // Remove API keys from traces  
"scrubFilePaths": false,       // Optionally scrub file paths  
"scrubUserInput": false,       // Optionally scrub user prompts  
"allowedAttributes": \["agent", "model", "tool", "cost", "duration"\]  
}  
}
---

---

## **🎯 Recommendation Summary**

### **PRIMARY: Langfuse Cloud \+ TypeScript SDK**

**Setup Time:** 1 hour **Cost:** $0/mo (Hobby tier, 50K traces) **Features:**

* ✅ Multi-project dashboard out of the box
* ✅ TypeScript SDK with full typing
* ✅ LLM-specific observability (not generic APM)
* ✅ Cost tracking built-in
* ✅ Self-hosted option available (MIT license)
* ✅ Recently acquired by ClickHouse (strong future)

**Quick Start:**

\# 1\. Install SDK  
npm install langfuse @opentelemetry/api @opentelemetry/sdk-node

\# 2\. Configure  
echo '{"provider": "langfuse", "langfuse": {"publicKey": "pk-xxx", "secretKey": "sk-xxx"}}' \> \~/.config/oac/observability.json

\# 3\. Run with observability  
npm run test:openagent

\# 4\. View in dashboard  
open https://cloud.langfuse.com
---

---

## **🗂️ Next Steps (After Approval)**

1. **Create package structure** (`.opencode/observability/`)
2. **Install core dependencies** (OpenTelemetry \+ Langfuse)
3. **Implement tracer initialization**
4. **Add Langfuse provider**
5. **Instrument test runner** (proof of concept)
6. **Deploy to Langfuse Cloud** (or self-hosted)
7. **Document setup process**
8. **Add CLI commands** (`oac observe`)
9. **Create example configs** (Langfuse, Axiom, self-hosted)
10. **Test with multi-project setup**

---

---

## **📚 Additional Resources**

### **Langfuse Documentation**

* Setup: [https://langfuse.com/docs](https://langfuse.com/docs)
* TypeScript SDK: [https://langfuse.com/docs/sdk/typescript](https://langfuse.com/docs/sdk/typescript)
* Self-Hosting: [https://langfuse.com/self-hosting](https://langfuse.com/self-hosting)
* API Reference: [https://langfuse.com/docs/api](https://langfuse.com/docs/api)

### **OpenTelemetry Documentation**

* JavaScript SDK: [https://opentelemetry.io/docs/languages/js/](https://opentelemetry.io/docs/languages/js/)
* Best Practices: [https://opentelemetry.io/docs/specs/otel/trace/semantic\_conventions/](https://opentelemetry.io/docs/specs/otel/trace/semantic_conventions/)

### **Alternative Platform Docs**

* Axiom: [https://axiom.co/docs](https://axiom.co/docs)
* Grafana Cloud: [https://grafana.com/docs/grafana-cloud/](https://grafana.com/docs/grafana-cloud/)
* LangSmith: [https://docs.langchain.com/langsmith](https://docs.langchain.com/langsmith)