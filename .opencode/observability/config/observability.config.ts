import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Zod schemas for configuration validation
export const LangfuseConfigSchema = z.object({
  publicKey: z.string(),
  secretKey: z.string(),
  baseUrl: z.string().optional(),
  projects: z.record(z.string(), z.string()).optional(),
});

export const ProjectConfigSchema = z.object({
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  langfuse: LangfuseConfigSchema.optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ObservabilityConfigSchema = z.object({
  provider: z.enum(['langfuse', 'axiom', 'otlp', 'json']).optional(),
  enabled: z.boolean().optional(),
  level: z.enum(['basic', 'detailed', 'full']).optional(),
  sampling: z.object({
    default: z.number().optional(),
    byAgent: z.record(z.string(), z.number()).optional(),
    byModel: z.record(z.string(), z.number()).optional(),
  }).optional(),
  langfuse: LangfuseConfigSchema.optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  exporters: z.object({
    console: z.object({
      enabled: z.boolean().optional(),
      level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    }).optional(),
    json: z.object({
      enabled: z.boolean().optional(),
      path: z.string().optional(),
      maxFiles: z.number().optional(),
      maxSizeMB: z.number().optional(),
    }).optional(),
  }).optional(),
  privacy: z.object({
    scrubApiKeys: z.boolean().optional(),
    scrubFilePaths: z.boolean().optional(),
    scrubUserInput: z.boolean().optional(),
    allowedAttributes: z.array(z.string()).optional(),
  }).optional(),
});

export type LangfuseConfig = z.infer<typeof LangfuseConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;

// Default configuration
export const DEFAULT_CONFIG: ObservabilityConfig = {
  provider: 'langfuse',
  enabled: true,
  level: 'detailed',
  sampling: {
    default: 1.0,
  },
  attributes: {
    'service.name': 'openagents-control',
    'service.version': '0.7.1',
    'deployment.environment': 'development',
  },
  exporters: {
    console: {
      enabled: true,
      level: 'info',
    },
    json: {
      enabled: true,
      path: '~/.local/share/oac/observability',
      maxFiles: 100,
      maxSizeMB: 500,
    },
  },
  privacy: {
    scrubApiKeys: true,
    scrubFilePaths: false,
    scrubUserInput: false,
  },
};

export class ObservabilityConfigLoader {
  private config: ObservabilityConfig;

  constructor() {
    this.config = DEFAULT_CONFIG;
  }

  // Load configuration from file
  loadFromFile(filePath: string): ObservabilityConfig {
    try {
      const resolvedPath = this.resolvePath(filePath);
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Validate and merge with defaults
      this.config = ObservabilityConfigSchema.parse({
        ...DEFAULT_CONFIG,
        ...parsed,
      });

      return this.config;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Configuration validation failed: ${error.message}`);
      }
      throw new Error(`Failed to load configuration from ${filePath}: ${error}`);
    }
  }

  // Load project-specific configuration
  loadProjectConfig(projectName: string): ProjectConfig | null {
    const projectConfigPath = path.join('.opencode', 'observability.json');

    try {
      const content = fs.readFileSync(projectConfigPath, 'utf-8');
      const parsed = JSON.parse(content);

      const projectConfig = ProjectConfigSchema.parse(parsed);

      // Validate project matches
      if (projectConfig.projectName !== projectName) {
        return null;
      }

      return projectConfig;
    } catch {
      return null;
    }
  }

  // Get current configuration
  getConfig(): ObservabilityConfig {
    return this.config;
  }

  // Update configuration
  updateConfig(updates: Partial<ObservabilityConfig>): void {
    this.config = ObservabilityConfigSchema.parse({
      ...this.config,
      ...updates,
    });
  }

  // Check if observability is enabled
  isEnabled(): boolean {
    return this.config.enabled ?? true;
  }

  // Get sampling rate for specific agent
  getSamplingRate(agentName?: string, modelName?: string): number {
    if (!this.config.sampling) {
      return 1.0;
    }

    if (agentName && this.config.sampling.byAgent?.[agentName] !== undefined) {
      return this.config.sampling.byAgent[agentName];
    }

    if (modelName && this.config.sampling.byModel?.[modelName] !== undefined) {
      return this.config.sampling.byModel[modelName];
    }

    return this.config.sampling.default ?? 1.0;
  }

  // Resolve path with home directory expansion
  private resolvePath(filePath: string): string {
    if (filePath.startsWith('~')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      return path.resolve(homeDir, filePath.slice(1));
    }
    return path.resolve(filePath);
  }
}

// Singleton instance
let configLoaderInstance: ObservabilityConfigLoader | null = null;

export function getConfigLoader(): ObservabilityConfigLoader {
  if (!configLoaderInstance) {
    configLoaderInstance = new ObservabilityConfigLoader();
  }
  return configLoaderInstance;
}

export function loadConfig(filePath?: string): ObservabilityConfig {
  const loader = getConfigLoader();

  if (filePath) {
    return loader.loadFromFile(filePath);
  }

  // Try default locations
  const defaultPaths = [
    '~/.config/oac/observability.json',
    '.opencode/observability.json',
  ];

  for (const configPath of defaultPaths) {
    try {
      return loader.loadFromFile(configPath);
    } catch {
      continue;
    }
  }

  // Return default config if no file found
  return loader.getConfig();
}
