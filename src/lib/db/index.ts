/**
 * Database Initialization Module
 * 
 * Handles database connection verification and schema validation.
 * Provides comprehensive logging for debugging.
 */

import { supabase } from "@/integrations/supabase/client";
import { 
  validateSchema, 
  validateAuthTrigger, 
  getSchemaStatusSummary,
  type SchemaValidationResult 
} from "./schema-validator";

export type { SchemaValidationResult };
export { getSchemaStatusSummary };

interface DBInitResult {
  connected: boolean;
  schemaValid: boolean;
  authTriggerValid: boolean;
  schemaResult: SchemaValidationResult | null;
  error: string | null;
}

/**
 * Log with consistent prefix for DB initialization
 */
function dbLog(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
  const prefix = '[DB INIT]';
  const timestamp = new Date().toISOString();
  
  switch (level) {
    case 'info':
      console.log(`${prefix} ${timestamp} ${message}`, data ?? '');
      break;
    case 'warn':
      console.warn(`${prefix} ${timestamp} ⚠️ ${message}`, data ?? '');
      break;
    case 'error':
      console.error(`${prefix} ${timestamp} ❌ ${message}`, data ?? '');
      break;
  }
}

/**
 * Test the Supabase connection
 */
async function testConnection(): Promise<boolean> {
  dbLog('info', 'Testing Supabase connection...');
  
  try {
    // Simple health check - try to get session (works even without auth)
    const { error } = await supabase.auth.getSession();
    
    if (error) {
      dbLog('error', 'Connection test failed:', error.message);
      return false;
    }
    
    dbLog('info', '✓ Connected to Supabase successfully');
    return true;
  } catch (error) {
    dbLog('error', 'Connection error:', error);
    return false;
  }
}

/**
 * Get environment configuration status
 */
function logEnvironmentStatus() {
  dbLog('info', 'Checking environment configuration...');
  
  const hasUrl = !!import.meta.env.VITE_SUPABASE_URL;
  const hasKey = !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  if (hasUrl && hasKey) {
    dbLog('info', '✓ Environment variables configured');
    dbLog('info', `  SUPABASE_URL: ${import.meta.env.VITE_SUPABASE_URL?.substring(0, 30)}...`);
  } else {
    if (!hasUrl) dbLog('error', 'Missing VITE_SUPABASE_URL');
    if (!hasKey) dbLog('error', 'Missing VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  
  return hasUrl && hasKey;
}

/**
 * Initialize and validate the database
 */
export async function initializeDatabase(): Promise<DBInitResult> {
  dbLog('info', '========================================');
  dbLog('info', 'Starting Database Initialization');
  dbLog('info', '========================================');
  
  const result: DBInitResult = {
    connected: false,
    schemaValid: false,
    authTriggerValid: false,
    schemaResult: null,
    error: null,
  };
  
  try {
    // Step 1: Check environment
    const envOk = logEnvironmentStatus();
    if (!envOk) {
      result.error = 'Missing required environment variables';
      dbLog('error', result.error);
      return result;
    }
    
    // Step 2: Test connection
    result.connected = await testConnection();
    if (!result.connected) {
      result.error = 'Failed to connect to Supabase';
      dbLog('error', result.error);
      return result;
    }
    
    // Step 3: Validate schema
    result.schemaResult = await validateSchema();
    result.schemaValid = result.schemaResult.isValid;
    
    // Step 4: Validate auth trigger
    result.authTriggerValid = await validateAuthTrigger();
    
    // Log summary
    dbLog('info', '========================================');
    dbLog('info', 'Database Initialization Complete');
    dbLog('info', '========================================');
    dbLog('info', `Connection: ${result.connected ? '✓' : '❌'}`);
    dbLog('info', `Schema: ${result.schemaValid ? '✓' : '❌'}`);
    dbLog('info', `Auth Trigger: ${result.authTriggerValid ? '✓' : '❌'}`);
    
    if (!result.schemaValid && result.schemaResult) {
      dbLog('warn', '\n' + getSchemaStatusSummary(result.schemaResult));
    }
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown initialization error';
    dbLog('error', 'Initialization failed:', error);
  }
  
  return result;
}

/**
 * Quick connection check (for use during app lifecycle)
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.getSession();
    return !error;
  } catch {
    return false;
  }
}
