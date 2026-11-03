/**
 * Universal Supabase Client Factory
 * 
 * Creates Supabase clients that work across all runtimes.
 * Uses dynamic import to work in both Deno and Node.js environments.
 */

import { getEnv, requireEnv } from './runtime';

// Re-export types for convenience
export type { SupabaseClient } from '@supabase/supabase-js';

// Lazy-loaded client module
let supabaseModule: typeof import('@supabase/supabase-js') | null = null;

/**
 * Get the Supabase module (handles different import methods)
 */
async function getSupabaseModule() {
  if (supabaseModule) return supabaseModule;
  
  // Dynamic import works in both ESM and Deno
  supabaseModule = await import('@supabase/supabase-js');
  return supabaseModule;
}

/**
 * Create a Supabase client with service role key (for server-side operations)
 */
export async function createServiceClient() {
  const { createClient } = await getSupabaseModule();
  
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client with anon key (for public operations)
 */
export async function createAnonClient() {
  const { createClient } = await getSupabaseModule();
  
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  
  return createClient(supabaseUrl, anonKey);
}

/**
 * Create a Supabase client with a user's auth token
 */
export async function createUserClient(authHeader: string) {
  const { createClient } = await getSupabaseModule();
  
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  
  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

/**
 * Get Supabase configuration
 */
export function getSupabaseConfig() {
  return {
    url: requireEnv('SUPABASE_URL'),
    anonKey: getEnv('SUPABASE_ANON_KEY') || getEnv('SUPABASE_PUBLISHABLE_KEY'),
    serviceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };
}
