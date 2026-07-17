import { initObservability, getObservability } from '../../../observability/index.mjs';
import { loadConfig } from '../../../observability/config/observability.config.js';
import { detectProjectObservability, loadProjectObservability, isProjectObservabilityLoaded, getProjectObservabilityPath } from '../../../observability/collectors/session-collector.ts';

export interface ObservabilityAgentConfig {
  action: 'initialize' | 'send_trace' | 'configure' | 'status' | 'test_connection' | 'detect_project';
  sessionId?: string;
  projectPath?: string;
  traceData?: any;
  config?: any;
}

export class ObservabilityAgent {
  private observability: Observability | null = null;
  private config: any = null;

  constructor() {
    this.loadConfiguration();
  }

  private loadConfiguration() {
    try {
      this.config = loadConfig();
      console.log('✅ Observability configuration loaded');
    } catch (error) {
      console.error('❌ Failed to load observability configuration:', error.message);
      throw error;
    }
  }

  async execute(config: ObservabilityAgentConfig): Promise<any> {
    switch (config.action) {
      case 'initialize':
        return this.initializeObservability(config.sessionId, config.projectPath);

      case 'detect_project':
        return this.detectProjectObservability(config.projectPath);

      case 'send_trace':
        return this.sendTrace(config.traceData);

      case 'configure':
        return this.updateConfiguration(config.config);

      case 'status':
        return this.getStatus();

      case 'test_connection':
        return this.testConnection();

      default:
        throw new Error(`Unknown action: ${config.action}`);
    }
  }

  private async initializeObservability(sessionId?: string, projectPath?: string): Promise<any> {
    try {
      console.log('🔧 Initializing observability system...');

      // Initialize the global observability instance
      this.observability = initObservability();

      console.log('✅ Observability system initialized');

      // Detect and load project-specific observability if projectPath provided
      if (projectPath) {
        const detected = detectProjectObservability(projectPath);
        if (detected) {
          console.log(`🔍 Project observability detected: ${detected}`);
          await loadProjectObservability(projectPath);
          console.log(`📦 Project observability loaded: ${getProjectObservabilityPath()}`);
        }
      }

      // Create initial session trace if sessionId provided
      if (sessionId && this.observability) {
        const trace = await this.observability.createTrace('session-start', {
          sessionId,
          timestamp: new Date().toISOString(),
          action: 'initialize'
        });

        console.log('📊 Session trace created:', trace.id);

        // Flush to ensure data is sent
        await this.observability.getLangfuseProvider()?.flush();
        console.log('🧹 Initial data flushed to provider');
      }

      return {
        status: 'success',
        message: 'Observability initialized successfully',
        sessionId,
        traceCreated: !!sessionId,
        projectObservabilityLoaded: isProjectObservabilityLoaded(),
        projectObservabilityPath: getProjectObservabilityPath()
      };

    } catch (error) {
      console.error('❌ Observability initialization failed:', error);
      return {
        status: 'error',
        message: `Initialization failed: ${error.message}`,
        error: error.message
      };
    }
  }

  private async detectProjectObservability(projectPath?: string): Promise<any> {
    if (!projectPath) {
      return {
        status: 'error',
        message: 'projectPath is required'
      };
    }

    const detected = detectProjectObservability(projectPath);
    const isLoaded = isProjectObservabilityLoaded();
    const path = getProjectObservabilityPath();

    return {
      status: 'success',
      projectPath,
      observabilityDetected: !!detected,
      observabilityPath: detected,
      isLoaded,
      loadedPath: path
    };
  }

  private async sendTrace(traceData: any): Promise<any> {
    if (!this.observability) {
      throw new Error('Observability not initialized. Call initialize first.');
    }

    try {
      console.log('📤 Sending trace data...');

      const trace = await this.observability.createTrace(
        traceData.name || 'agent-trace',
        traceData.input || {},
        traceData.metadata || {},
        traceData.tags || []
      );

      console.log('✅ Trace sent successfully:', trace.id);

      // Create spans for detailed execution data
      if (traceData.spans) {
        for (const spanData of traceData.spans) {
          const span = await this.observability.getLangfuseProvider()?.createSpan(
            trace,
            spanData.name,
            spanData.input,
            spanData.metadata
          );

          if (span) {
            span.update({ output: spanData.output });
            span.end();
          }
        }
      }

      // Flush data
      await this.observability.getLangfuseProvider()?.flush();
      console.log('🧹 Trace data flushed to provider');

      return {
        status: 'success',
        message: 'Trace sent successfully',
        traceId: trace.id
      };

    } catch (error) {
      console.error('❌ Trace transmission failed:', error);
      return {
        status: 'error',
        message: `Trace transmission failed: ${error.message}`,
        error: error.message
      };
    }
  }

  private async updateConfiguration(newConfig: any): Promise<any> {
    try {
      console.log('⚙️ Updating observability configuration...');

      // Merge with existing config
      this.config = { ...this.config, ...newConfig };

      // Reinitialize with new config
      if (this.observability) {
        await this.observability.shutdown();
        this.observability = initObservability();
      }

      console.log('✅ Configuration updated successfully');

      return {
        status: 'success',
        message: 'Configuration updated successfully',
        config: this.config
      };

    } catch (error) {
      console.error('❌ Configuration update failed:', error);
      return {
        status: 'error',
        message: `Configuration update failed: ${error.message}`,
        error: error.message
      };
    }
  }

  private getStatus(): any {
    return {
      status: 'success',
      initialized: !!this.observability,
      provider: this.config?.provider || 'none',
      enabled: this.config?.enabled || false,
      project: this.config?.langfuse?.project || 'none',
      configLoaded: !!this.config
    };
  }

  private async testConnection(): Promise<any> {
    try {
      console.log('🔍 Testing observability connection...');

      if (!this.observability) {
        this.observability = initObservability();
      }

      // Create a test trace
      const testTrace = await this.observability.createTrace('connection-test', {
        message: 'Testing Langfuse connection from ObservabilityAgent',
        timestamp: new Date().toISOString(),
        agent: 'ObservabilityAgent'
      });

      console.log('✅ Test trace created:', testTrace.id);

      // Create a test span
      const span = await this.observability.getLangfuseProvider()?.createSpan(
        testTrace,
        'test-span',
        { operation: 'connection-verification' }
      );

      if (span) {
        span.update({ output: { status: 'success' } });
        span.end();
      }

      // Flush and wait a moment for transmission
      await this.observability.getLangfuseProvider()?.flush();

      console.log('🧹 Test data flushed - check Langfuse dashboard');
      console.log('📊 Trace ID:', testTrace.id);

      return {
        status: 'success',
        message: 'Connection test completed - check Langfuse dashboard',
        traceId: testTrace.id,
        instructions: 'Check https://cloud.langfuse.com for trace: ' + testTrace.id
      };

    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return {
        status: 'error',
        message: `Connection test failed: ${error.message}`,
        error: error.message,
        troubleshooting: [
          'Verify API keys in .config/oac/observability.json',
          'Check project ID exists in Langfuse',
          'Ensure network connectivity to cloud.langfuse.com',
          'Validate JSON configuration syntax'
        ]
      };
    }
  }
}

// Export singleton instance
export const observabilityAgent = new ObservabilityAgent();

// Export convenience functions
export async function initializeObservability(sessionId?: string, projectPath?: string) {
  return observabilityAgent.execute({ action: 'initialize', sessionId, projectPath });
}

export async function detectProjectObservability(projectPath: string) {
  return observabilityAgent.execute({ action: 'detect_project', projectPath });
}

export async function sendTrace(traceData: any) {
  return observabilityAgent.execute({ action: 'send_trace', traceData });
}

export async function testObservabilityConnection() {
  return observabilityAgent.execute({ action: 'test_connection' });
}

export function getObservabilityStatus() {
  return observabilityAgent.execute({ action: 'status' });
}