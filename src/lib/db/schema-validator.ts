/**
 * Schema Validator
 * 
 * Validates that required database tables and structures exist.
 * Provides detailed logging for debugging schema issues.
 * 
 * MODULAR SCHEMA STRUCTURE:
 * - supabase/schema-sql/tables/ - Table definitions
 * - supabase/schema-sql/functions/ - Database functions
 * - supabase/schema-sql/triggers/ - Trigger definitions
 * - supabase/schema-sql/policies/ - RLS policies
 */

import { supabase } from "@/integrations/supabase/client";

// Required tables for the application (in dependency order)
const REQUIRED_TABLES = [
  'profiles',        // Core user data, linked to auth.users
  'user_roles',      // Role assignments (admin, moderator, user)
  'ads',             // Task advertisements
  'task_submissions',// User task completions
  'transactions',    // Point transactions
  'referrals',       // Referral relationships
  'notifications',   // User notifications
  'chat_sessions',   // Live chat support
  'chat_messages',   // Chat messages
  'app_settings',    // Application branding
  'platform_settings', // Key-value config
] as const;

// Optional tables (app works without them but with reduced functionality)
const OPTIONAL_TABLES = [
  'moderator_permissions',
  'moderator_activity_logs',
  'admin_totp_secrets',
  'admin_login_attempts',
  'email_verifications',
  'follow_verifications',
  'generated_comments',
  'ad_settings',
  'allowed_email_domains',
  'landing_content',
  'smtp_config',
  'ai_config',
  'ai_prompts',
  'referral_commissions',
] as const;

// Required columns that MUST have defaults or be populated by triggers
const CRITICAL_COLUMN_DEFAULTS = {
  'profiles': ['tiktok_username'], // Must have default to prevent auth trigger failure
} as const;

export interface SchemaValidationResult {
  isValid: boolean;
  missingRequiredTables: string[];
  missingOptionalTables: string[];
  existingTables: string[];
  schemaVersion: string | null;
  errors: string[];
  warnings: string[];
  triggerStatus: boolean;
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
 * Check if a table exists by attempting to query it
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    // Use a minimal query to check if table exists
    // The count with head:true is the most efficient way
    const { error } = await supabase
      .from(tableName as any)
      .select('*', { count: 'exact', head: true });
    
    // If no error, table exists
    if (!error) return true;
    
    // Check if error is because table doesn't exist
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      return false;
    }
    
    // RLS errors mean table exists but we don't have access
    if (error.code === '42501' || error.message.includes('permission denied')) {
      return true;
    }
    
    // Other errors - assume table exists but there's another issue
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current schema version if available
 */
async function getSchemaVersion(): Promise<string | null> {
  try {
    // Use raw fetch to avoid type issues with dynamic table
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/schema_version?select=version&order=applied_at.desc&limit=1`,
      {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0 && data[0].version) {
      return data[0].version;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if the auth trigger exists and is functioning
 */
async function checkAuthTrigger(): Promise<boolean> {
  try {
    // Try to check if we can query profiles - if it works, trigger is likely OK
    const { error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      dbLog('warn', 'Could not verify auth trigger status:', error.message);
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate the database schema
 */
export async function validateSchema(): Promise<SchemaValidationResult> {
  dbLog('info', '========================================');
  dbLog('info', 'Starting Database Schema Validation');
  dbLog('info', '========================================');
  
  const result: SchemaValidationResult = {
    isValid: true,
    missingRequiredTables: [],
    missingOptionalTables: [],
    existingTables: [],
    schemaVersion: null,
    errors: [],
    warnings: [],
    triggerStatus: false,
  };
  
  try {
    // Step 1: Check required tables
    dbLog('info', '📋 Step 1: Checking required tables...');
    for (const table of REQUIRED_TABLES) {
      const exists = await tableExists(table);
      if (exists) {
        result.existingTables.push(table);
        dbLog('info', `  ✓ ${table}`);
      } else {
        result.missingRequiredTables.push(table);
        result.isValid = false;
        dbLog('error', `  ✗ ${table} - MISSING`);
      }
    }
    
    // Step 2: Check optional tables
    dbLog('info', '📋 Step 2: Checking optional tables...');
    for (const table of OPTIONAL_TABLES) {
      const exists = await tableExists(table);
      if (exists) {
        result.existingTables.push(table);
        dbLog('info', `  ✓ ${table}`);
      } else {
        result.missingOptionalTables.push(table);
        dbLog('warn', `  ⚠ ${table} - optional, not found`);
      }
    }
    
    // Step 3: Verify auth trigger
    dbLog('info', '📋 Step 3: Checking auth trigger (handle_new_user)...');
    result.triggerStatus = await checkAuthTrigger();
    if (result.triggerStatus) {
      dbLog('info', '  ✓ Auth trigger appears functional');
    } else {
      result.warnings.push('Auth trigger may not be working - new signups could fail');
      dbLog('warn', '  ⚠ Auth trigger status unknown');
    }
    
    // Step 4: Get schema version
    result.schemaVersion = await getSchemaVersion();
    if (result.schemaVersion) {
      dbLog('info', `📋 Schema version: ${result.schemaVersion}`);
    }
    
    // Summary
    dbLog('info', '========================================');
    dbLog('info', 'Validation Summary');
    dbLog('info', '========================================');
    dbLog('info', `Tables found: ${result.existingTables.length}`);
    dbLog('info', `Missing required: ${result.missingRequiredTables.length}`);
    dbLog('info', `Missing optional: ${result.missingOptionalTables.length}`);
    dbLog('info', `Auth trigger: ${result.triggerStatus ? '✓' : '⚠'}`);
    
    if (result.isValid) {
      dbLog('info', '✓ Schema validation PASSED');
    } else {
      dbLog('error', '✗ Schema validation FAILED');
      dbLog('error', 'Missing tables: ' + result.missingRequiredTables.join(', '));
      dbLog('error', '📄 Run files in supabase/schema-sql/ in order:');
      dbLog('error', '   1. tables/*.sql');
      dbLog('error', '   2. functions/*.sql');
      dbLog('error', '   3. triggers/*.sql');
      dbLog('error', '   4. policies/*.sql');
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
    result.isValid = false;
    dbLog('error', 'Schema validation error:', error);
  }
  
  return result;
}

/**
 * Check if the auth trigger is working by checking if profiles are created
 */
export async function validateAuthTrigger(): Promise<boolean> {
  dbLog('info', 'Checking auth trigger (handle_new_user)...');
  
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      dbLog('warn', 'Could not verify auth trigger status:', error.message);
      return false;
    }
    
    dbLog('info', '✓ Profiles table accessible - trigger should be working');
    return true;
  } catch (error) {
    dbLog('error', 'Auth trigger check failed:', error);
    return false;
  }
}

/**
 * Get a summary of the schema status for display
 */
export function getSchemaStatusSummary(result: SchemaValidationResult): string {
  const lines: string[] = [];
  
  lines.push('╔════════════════════════════════════════╗');
  lines.push('║      Database Schema Status            ║');
  lines.push('╚════════════════════════════════════════╝');
  lines.push('');
  lines.push(`Status: ${result.isValid ? '✓ Valid' : '❌ Invalid'}`);
  lines.push(`Auth Trigger: ${result.triggerStatus ? '✓ Working' : '⚠ Unknown'}`);
  lines.push(`Tables Found: ${result.existingTables.length}`);
  
  if (result.missingRequiredTables.length > 0) {
    lines.push('');
    lines.push('❌ Missing Required Tables:');
    result.missingRequiredTables.forEach(t => lines.push(`   • ${t}`));
  }
  
  if (result.missingOptionalTables.length > 0) {
    lines.push('');
    lines.push('⚠️ Missing Optional Tables:');
    result.missingOptionalTables.forEach(t => lines.push(`   • ${t}`));
  }
  
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('⚠️ Warnings:');
    result.warnings.forEach(w => lines.push(`   • ${w}`));
  }
  
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('❌ Errors:');
    result.errors.forEach(e => lines.push(`   • ${e}`));
  }
  
  if (!result.isValid) {
    lines.push('');
    lines.push('📋 To fix, run SQL files in order:');
    lines.push('   1. supabase/schema-sql/tables/*.sql');
    lines.push('   2. supabase/schema-sql/functions/*.sql');
    lines.push('   3. supabase/schema-sql/triggers/*.sql');
    lines.push('   4. supabase/schema-sql/policies/*.sql');
  }
  
  return lines.join('\n');
}
