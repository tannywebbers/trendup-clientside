/**
 * Deno/Supabase Edge Functions Adapter
 * 
 * This adapter wraps universal handlers for use with Supabase Edge Functions (Deno runtime).
 * 
 * Usage in edge function:
 * ```typescript
 * import { createDenoHandler } from './adapters/deno';
 * import { handleAdminLogin } from '../handlers/admin-login';
 * 
 * export default createDenoHandler(async (req) => {
 *   const body = await req.json();
 *   const result = await handleAdminLogin(body);
 *   return new Response(JSON.stringify(result), {
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * });
 * ```
 */

import { corsHeaders, type UniversalHandler } from '../runtime';

/**
 * Create a Deno-compatible handler with CORS and error handling
 */
export function createDenoHandler(handler: UniversalHandler): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const response = await handler(req);
      
      // Ensure CORS headers are included
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        if (!newHeaders.has(key)) {
          newHeaders.set(key, value);
        }
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      console.error('Handler error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  };
}

/**
 * Serve helper that matches Deno's serve pattern
 * This is a pass-through for use in edge functions
 */
export function serve(handler: (req: Request) => Promise<Response>): void {
  // In Deno, we use Deno.serve
  // @ts-ignore - Deno global
  if (typeof Deno !== 'undefined' && Deno.serve) {
    // @ts-ignore
    Deno.serve(handler);
  }
}
