import { SemanticAttributes, SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Standard attributes for observability
export const OBSERVABILITY_ATTRIBUTES = {
  // Agent attributes
  AGENT_NAME: 'agent.name',
  AGENT_TYPE: 'agent.type',
  AGENT_VERSION: 'agent.version',
  AGENT_EXECUTION_ID: 'agent.execution.id',

  // Model attributes
  MODEL_NAME: 'model.name',
  MODEL_PROVIDER: 'model.provider',
  MODEL_VERSION: 'model.version',
  MODEL_TOKENS_IN: 'model.tokens.in',
  MODEL_TOKENS_OUT: 'model.tokens.out',
  MODEL_COST: 'model.cost',

  // Tool attributes
  TOOL_NAME: 'tool.name',
  TOOL_TYPE: 'tool.type',
  TOOL_EXECUTION_TIME: 'tool.execution_time_ms',

  // Session attributes
  SESSION_ID: 'session.id',
  SESSION_DURATION: 'session.duration_ms',
  SESSION_TOTAL_COST: 'session.total_cost',

  // Project attributes
  PROJECT_NAME: 'project.name',
  PROJECT_ID: 'project.id',

  // Error attributes
  ERROR_TYPE: 'error.type',
  ERROR_MESSAGE: 'error.message',
  ERROR_CODE: 'error.code',

  // Approval attributes
  APPROVAL_REQUIRED: 'approval.required',
  APPROVAL_WAIT_TIME: 'approval.wait_time_ms',
  APPROVAL_GRANTED: 'approval.granted',

  // Cache attributes
  CACHE_HIT: 'cache.hit',
  CACHE_KEY: 'cache.key',
  CACHE_SAVINGS: 'cache.savings',
} as const;

// Semantic conventions for LLM operations
export const LLM_SEMANTIC_ATTRIBUTES = {
  ...SemanticAttributes,
  LLM_SYSTEM: 'llm.system',
  LLM_USER: 'llm.user',
  LLM_ASSISTANT: 'llm.assistant',
  LLM_REQUEST_ID: 'llm.request.id',
  LLM_USAGE_PROMPT_TOKENS: 'llm.usage.prompt_tokens',
  LLM_USAGE_COMPLETION_TOKENS: 'llm.usage.completion_tokens',
  LLM_USAGE_TOTAL_TOKENS: 'llm.usage.total_tokens',
} as const;

// Helper functions for creating standardized attributes
export function createAgentAttributes(agentName: string, agentType: string, executionId?: string) {
  return {
    [OBSERVABILITY_ATTRIBUTES.AGENT_NAME]: agentName,
    [OBSERVABILITY_ATTRIBUTES.AGENT_TYPE]: agentType,
    ...(executionId && { [OBSERVABILITY_ATTRIBUTES.AGENT_EXECUTION_ID]: executionId }),
  };
}

export function createModelAttributes(modelName: string, provider: string, tokensIn?: number, tokensOut?: number, cost?: number) {
  return {
    [OBSERVABILITY_ATTRIBUTES.MODEL_NAME]: modelName,
    [OBSERVABILITY_ATTRIBUTES.MODEL_PROVIDER]: provider,
    ...(tokensIn !== undefined && { [OBSERVABILITY_ATTRIBUTES.MODEL_TOKENS_IN]: tokensIn }),
    ...(tokensOut !== undefined && { [OBSERVABILITY_ATTRIBUTES.MODEL_TOKENS_OUT]: tokensOut }),
    ...(cost !== undefined && { [OBSERVABILITY_ATTRIBUTES.MODEL_COST]: cost }),
  };
}

export function createToolAttributes(toolName: string, toolType: string, executionTimeMs?: number) {
  return {
    [OBSERVABILITY_ATTRIBUTES.TOOL_NAME]: toolName,
    [OBSERVABILITY_ATTRIBUTES.TOOL_TYPE]: toolType,
    ...(executionTimeMs !== undefined && { [OBSERVABILITY_ATTRIBUTES.TOOL_EXECUTION_TIME]: executionTimeMs }),
  };
}

export function createSessionAttributes(sessionId: string, durationMs?: number, totalCost?: number) {
  return {
    [OBSERVABILITY_ATTRIBUTES.SESSION_ID]: sessionId,
    ...(durationMs !== undefined && { [OBSERVABILITY_ATTRIBUTES.SESSION_DURATION]: durationMs }),
    ...(totalCost !== undefined && { [OBSERVABILITY_ATTRIBUTES.SESSION_TOTAL_COST]: totalCost }),
  };
}

export function createProjectAttributes(projectName: string, projectId?: string) {
  return {
    [OBSERVABILITY_ATTRIBUTES.PROJECT_NAME]: projectName,
    ...(projectId && { [OBSERVABILITY_ATTRIBUTES.PROJECT_ID]: projectId }),
  };
}