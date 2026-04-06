/**
 * Auto-Instrumentation Hooks
 * 
 * Wrapper functions for automatic observability capture.
 */

export {
  instrumentedTool,
  instrumentedAgent,
  instrumentedLLM,
  createSpan,
  type ToolCallResult,
  type LLMCallResult,
  type AgentResult,
} from "./auto-instrument.js";

export {
  getCurrentModel,
  setCurrentModel,
  clearCurrentModel,
  detectFromHeaders,
  extractProvider,
  type ModelInfo,
  type LLMResponse,
} from "./model-detector.js";
