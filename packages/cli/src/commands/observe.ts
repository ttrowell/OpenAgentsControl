/**
 * observeCommand - View Langfuse traces from CLI
 * 
 * Provides commands for:
 * - Listing recent traces
 * - Viewing trace details
 * - Checking observability status
 * - Testing connection
 */

import { type Command } from "commander";
import { log, info, warn, bold, dim } from "../ui/logger.js";

// Types
export type ObserveOptions = {
  action: "list" | "status" | "test" | "models";
  limit?: number;
  verbose?: boolean;
};

// Pure helper functions
const formatDate = (iso: string): string => {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
};

const truncate = (str: string, maxLen: number): string => {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + "...";
};

const formatCost = (cost: number): string => {
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(2)}K`;
  }
  return `$${cost.toFixed(4)}`;
};

const getLangfuseConfig = () => {
  return {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
  };
};

/**
 * List recent traces from Langfuse
 */
async function listTraces(limit: number = 10, verbose: boolean = false): Promise<void> {
  const config = getLangfuseConfig();

  if (!config.publicKey || !config.secretKey) {
    warn("No Langfuse credentials configured.");
    info("Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in your .env file.");
    return;
  }

  const auth = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64");

  try {
    const response = await fetch(`${config.baseUrl}/api/public/traces?limit=${limit}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        warn("Invalid Langfuse credentials. Check your API keys.");
      } else {
        warn(`Langfuse API error: ${response.status} ${response.statusText}`);
      }
      return;
    }

    const data = await response.json() as {
      data: Array<{
        id: string;
        name: string;
        timestamp: string;
        userId?: string;
        sessionId?: string;
        input?: string;
        output?: string;
        totalCost?: number;
      }>;
      meta: { totalItems: number };
    };

    if (!data.data || data.data.length === 0) {
      info("No traces found.");
      dim("Traces may take 1-2 minutes to appear due to async processing.");
      return;
    }

    log("");
    bold(`Recent Traces (${data.meta.totalItems} total):`);
    log("");

    for (const trace of data.data) {
      const date = formatDate(trace.timestamp);
      const name = truncate(trace.name || "unnamed", 40);
      const input = trace.input ? truncate(JSON.stringify(trace.input), 50) : "";

      log(`  ${name}`);
      dim(`    ${date} | ${trace.id.substring(0, 8)}...`);

      if (verbose) {
        if (trace.userId) log(`    user: ${trace.userId}`);
        if (trace.sessionId) log(`    session: ${trace.sessionId}`);
        if (input) dim(`    input: ${input}`);
        if (trace.totalCost !== undefined && trace.totalCost > 0) {
          log(`    cost: ${formatCost(trace.totalCost)}`);
        }
      }
      log("");
    }
  } catch (error) {
    warn(`Failed to fetch traces: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Show observability status
 */
function showStatus(): void {
  const config = getLangfuseConfig();

  log("");
  bold("Observability Status:");
  log("");

  const hasCredentials = !!(config.publicKey && config.secretKey);

  log(`  Provider:    langfuse`);
  log(`  Enabled:     ${hasCredentials ? "✓" : "✗"}`);
  log(`  Credentials: ${hasCredentials ? "✓ configured" : "✗ missing"}`);
  log(`  Base URL:    ${config.baseUrl}`);
  log("");

  if (!hasCredentials) {
    warn("Configure Langfuse credentials to enable tracing:");
    info("  Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in .env");
  }
}

/**
 * Test Langfuse connection
 */
async function testConnection(): Promise<void> {
  const config = getLangfuseConfig();

  if (!config.publicKey || !config.secretKey) {
    warn("No Langfuse credentials configured.");
    return;
  }

  const auth = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64");

  log("Testing Langfuse connection...");
  log(`  Base URL: ${config.baseUrl}`);
  log("");

  try {
    const response = await fetch(`${config.baseUrl}/api/public/traces?limit=1`, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json() as { meta: { totalItems: number } };
      bold(`✓ Connection successful!`);
      log(`  Found ${data.meta.totalItems} traces`);
    } else if (response.status === 401) {
      warn("✗ Authentication failed. Check your API keys.");
    } else {
      warn(`✗ API error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    warn(`✗ Connection failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Show model usage (placeholder)
 */
function showModels(): void {
  log("");
  bold("Model Usage:");
  log("");
  info("Model usage metrics are collected during agent sessions.");
  dim("Run some agent tasks to see model metrics here.");
  log("");
}

// Main command
export async function observeCommand(options: ObserveOptions): Promise<void> {
  switch (options.action) {
    case "list":
      await listTraces(options.limit || 10, options.verbose || false);
      break;
    case "status":
      showStatus();
      break;
    case "test":
      await testConnection();
      break;
    case "models":
      showModels();
      break;
  }
}

// Commander registration
export function registerObserveCommand(program: Command): void {
  program
    .command("observe")
    .description("View Langfuse traces and observability status")
    .argument("[action]", "Action: list | status | test | models", "status")
    .option("-l, --limit <number>", "Number of traces to show", "10")
    .option("-v, --verbose", "Show detailed trace information", false)
    .action(async (action: string, opts: { limit?: string; verbose?: boolean }) => {
      await observeCommand({
        action: action as ObserveOptions["action"],
        limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        verbose: opts.verbose,
      });
    });
}
