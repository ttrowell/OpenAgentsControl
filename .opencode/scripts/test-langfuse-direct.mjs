#!/usr/bin/env node
/**
 * Direct Langfuse SDK Test
 * Bypasses OpenTelemetry to test basic connectivity and authentication
 */

import { Langfuse } from 'langfuse';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

console.log('🧪 Running DIRECT Langfuse SDK test (bypassing OTEL)...\n');

// Load config from JSON if env vars not set
if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
  const configPath = path.join(process.cwd(), '.config/oac/observability.json');
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (fileConfig.langfuse?.publicKey) process.env.LANGFUSE_PUBLIC_KEY = fileConfig.langfuse.publicKey;
      if (fileConfig.langfuse?.secretKey) process.env.LANGFUSE_SECRET_KEY = fileConfig.langfuse.secretKey;
      if (fileConfig.langfuse?.baseUrl) process.env.LANGFUSE_BASE_URL = fileConfig.langfuse.baseUrl;
      console.log('✅ Loaded keys from observability.json config');
    } catch (e) {
      console.warn('⚠️ Could not load config file');
    }
  }
}

const config = {
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com'
};

console.log('🔑 Configuration:');
console.log(`   Public Key : ${config.publicKey ? config.publicKey.substring(0, 15) + '...' : 'MISSING'}`);
console.log(`   Secret Key : ${config.secretKey ? 'SET' : 'MISSING'}`);
console.log(`   Base URL   : ${config.baseUrl}`);

if (!config.publicKey || !config.secretKey) {
  console.error('❌ Missing API keys. Please set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY');
  console.error('💡 Get keys from: https://cloud.langfuse.com/project/_/settings/api-keys');
  process.exit(1);
}

const langfuse = new Langfuse({
  publicKey: config.publicKey,
  secretKey: config.secretKey,
  baseUrl: config.baseUrl,
});

async function runDirectTest() {
  try {
    console.log('\n📡 Creating direct trace...');
    
    const trace = langfuse.trace({
      name: 'direct-test-' + Date.now(),
      input: { test: 'direct-sdk-test' },
      metadata: {
        source: 'direct-test',
        timestamp: new Date().toISOString(),
        testType: 'connectivity'
      },
    });

    console.log(`✅ Trace created with ID: ${trace.id}`);

    const span = trace.span({
      name: 'direct-span',
      input: { operation: 'test-connection' }
    });

    span.update({
      output: { status: 'success', message: 'Direct SDK test completed' }
    });

    span.end();
    console.log('✅ Span completed');

    await langfuse.flush();
    console.log('✅ Data flushed to Langfuse');

    console.log('\n🎉 SUCCESS: Direct test completed');
    console.log(`🔗 View trace: https://us.cloud.langfuse.com/trace/${trace.id}`);
    
  } catch (error) {
    console.error('\n❌ Direct test failed:');
    console.error('Message:', error.message);
    console.error('Full error:', error);
    
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.error('\n🔑 Authentication error - your API keys may be invalid or expired');
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      console.error('\n🌐 Network error - check your internet connection');
    }
  }
}

runDirectTest();
