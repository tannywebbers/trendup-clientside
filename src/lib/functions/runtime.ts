/**
 * Universal Runtime Adapter
 * 
 * This module provides a runtime-agnostic way to access environment variables
 * and other platform-specific features across:
 * - Deno (Supabase Edge Functions / Lovable Cloud)
 * - Node.js (Vercel, Netlify, VPS)
 * - Browser (for shared types)
 */

// Detect runtime environment
export type Runtime = 'deno' | 'node' | 'browser' | 'unknown';

export function detectRuntime(): Runtime {
  // @ts-ignore - Deno global
  if (typeof Deno !== 'undefined') {
    return 'deno';
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node';
  }
  if (typeof window !== 'undefined') {
    return 'browser';
  }
  return 'unknown';
}

/**
 * Get environment variable - works across all runtimes
 */
export function getEnv(key: string): string | undefined {
  const runtime = detectRuntime();
  
  switch (runtime) {
    case 'deno':
      // @ts-ignore - Deno global
      return Deno.env.get(key);
    case 'node':
      return process.env[key];
    case 'browser':
      // For browser, try to get from import.meta.env (Vite)
      // @ts-ignore
      return import.meta?.env?.[key];
    default:
      return undefined;
  }
}

/**
 * Required environment variable - throws if not set
 */
export function requireEnv(key: string): string {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Standard CORS headers for API responses
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Create a CORS-enabled JSON response
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create an error response
 */
export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Handle CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

/**
 * Universal handler type that works across all platforms
 */
export type UniversalHandler = (req: Request) => Promise<Response>;

/**
 * Wrap a handler with CORS support
 */
export function withCors(handler: UniversalHandler): UniversalHandler {
  return async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;
    
    try {
      return await handler(req);
    } catch (error) {
      console.error('Handler error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return errorResponse(message);
    }
  };
}
