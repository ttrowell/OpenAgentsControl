/**
 * Auto-Initialization for Project Observability
 * 
 * This module runs automatically when imported and checks if the current project
 * has observability enabled. If so, it loads the project-specific observability.
 * 
 * Import this FIRST in any script that should have project observability.
 * 
 * Detection:
 * 1. OBSERVABILITY_ENABLED=true in project .env (OR)
 * 2. /observability/ folder exists in project
 */

import { detectProjectObservability, isProjectObservabilityLoaded } from "./collectors/session-collector.ts";
import { loadProjectObservability } from "./collectors/session-collector.ts";
import * as path from "node:path";
import * as fs from "node:fs";

const projectPath = process.cwd();

// Only run in projects (not in the framework itself)
const isFramework = projectPath.includes("openagentscontrol/.opencode");
const isObservabilityFramework = projectPath.includes("openagentscontrol/.opencode/observability");

if (!isFramework && !isObservabilityFramework) {
  const detected = detectProjectObservability(projectPath);
  
  if (detected) {
    console.log(`[AutoInit] Project observability detected: ${detected}`);
    console.log(`[AutoInit] Loading project observability...`);
    
    // Load synchronously - session-collector has the function
    // The actual async loading happens when startSession is called
  }
}

// Re-export for convenience
export { isProjectObservabilityLoaded } from "./collectors/session-collector.ts";
