/**
 * Trace Context - Rich metadata for Langfuse traces
 * 
 * Captures contextual information to make traces meaningful:
 * - Agent context (name, type, version)
 * - Task context (goal, constraints)
 * - User context (message, turn number)
 * - Build context (git hash, commit, version)
 * - Enhanced error details (stack traces)
 */

import { execSync } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";

// Types
export interface AgentContext {
  name: string;
  type: string;
  version?: string;
}

export interface TaskContext {
  goal?: string;
  constraints?: string[];
  taskId?: string;
  workflowId?: string;
}

export interface UserContext {
  message?: string;
  turnNumber?: number;
  userId?: string;
  sessionType?: string;
}

export interface BuildContext {
  gitHash?: string;
  gitBranch?: string;
  gitTag?: string;
  commitMessage?: string;
  version?: string;
  buildTime?: string;
}

export interface ErrorContext {
  message: string;
  stack?: string;
  code?: string;
  name?: string;
}

export interface TraceContext {
  agent: AgentContext;
  task?: TaskContext;
  user?: UserContext;
  build: BuildContext;
  system: {
    hostname: string;
    platform: string;
    arch: string;
    nodeVersion: string;
    username: string;
    cwd: string;
  };
}

// Singleton build context (computed once)
let cachedBuildContext: BuildContext | null = null;

/**
 * Get build context (git info, version, etc.)
 * Cached for performance
 */
export function getBuildContext(): BuildContext {
  if (cachedBuildContext) return cachedBuildContext;

  const ctx: BuildContext = {
    buildTime: new Date().toISOString(),
  };

  try {
    // Get git hash
    try {
      ctx.gitHash = execSync("git rev-parse HEAD", {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 1000,
      }).trim().slice(0, 8);
    } catch {
      ctx.gitHash = "unknown";
    }

    // Get git branch
    try {
      ctx.gitBranch = execSync("git branch --show-current", {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 1000,
      }).trim() || "detached";
    } catch {
      ctx.gitBranch = "unknown";
    }

    // Get git tag (if any)
    try {
      const tag = execSync("git describe --tags --exact-match 2>/dev/null || git describe --tags 2>/dev/null || echo ''", {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 1000,
      }).trim();
      if (tag) ctx.gitTag = tag;
    } catch {
      // No tag
    }

    // Get latest commit message (first line)
    try {
      ctx.commitMessage = execSync("git log -1 --pretty=%B", {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 1000,
      }).trim().split("\n")[0];
    } catch {
      ctx.commitMessage = "unknown";
    }

    // Get version from package.json
    try {
      const pkgPath = path.join(process.cwd(), "package.json");
      const pkg = JSON.parse(
        require("fs").readFileSync(pkgPath, "utf8")
      );
      ctx.version = pkg.version;
    } catch {
      ctx.version = "0.0.0";
    }
  } catch {
    // Silently fail - git might not be available
  }

  cachedBuildContext = ctx;
  return ctx;
}

/**
 * Get system context
 */
export function getSystemContext(): TraceContext["system"] {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    username: os.userInfo().username,
    cwd: process.cwd(),
  };
}

/**
 * Create full trace context
 */
export function createTraceContext(
  agent: AgentContext,
  options?: {
    task?: TaskContext;
    user?: UserContext;
  }
): TraceContext {
  return {
    agent,
    task: options?.task,
    user: options?.user,
    build: getBuildContext(),
    system: getSystemContext(),
  };
}

/**
 * Convert error to error context
 */
export function captureError(error: unknown): ErrorContext {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    return {
      message: String(err.message || "Unknown error"),
      stack: err.stack ? String(err.stack) : undefined,
      code: err.code ? String(err.code) : undefined,
      name: err.name ? String(err.name) : undefined,
    };
  }

  return { message: "Unknown error type" };
}

/**
 * Convert trace context to metadata object for spans
 */
export function toMetadata(context: TraceContext): Record<string, unknown> {
  return {
    // Agent
    "agent.name": context.agent.name,
    "agent.type": context.agent.type,
    "agent.version": context.agent.version || context.build.version,

    // Task
    "task.goal": context.task?.goal,
    "task.id": context.task?.taskId,
    "task.workflowId": context.task?.workflowId,
    "task.constraints": context.task?.constraints,

    // User
    "user.message": context.user?.message,
    "user.turnNumber": context.user?.turnNumber,
    "user.sessionType": context.user?.sessionType,

    // Build
    "build.gitHash": context.build.gitHash,
    "build.gitBranch": context.build.gitBranch,
    "build.gitTag": context.build.gitTag,
    "build.commitMessage": context.build.commitMessage,
    "build.version": context.build.version,
    "build.buildTime": context.build.buildTime,

    // System
    "system.hostname": context.system.hostname,
    "system.platform": context.system.platform,
    "system.arch": context.system.arch,
    "system.nodeVersion": context.system.nodeVersion,
    "system.cwd": context.system.cwd,
  };
}

/**
 * Flatten trace context for propagation
 */
export function toAttributes(context: TraceContext): Record<string, string | string[]> {
  const metadata = toMetadata(context);
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      result[key] = String(value);
    }
  }

  return result;
}

/**
 * Clear cached build context (useful for testing)
 */
export function clearBuildContextCache(): void {
  cachedBuildContext = null;
}
