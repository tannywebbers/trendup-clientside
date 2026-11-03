/**
 * Vercel/Netlify/Node.js Adapter
 * 
 * This adapter wraps universal handlers for use with Vercel/Netlify serverless functions.
 * 
 * Usage for Vercel (api/admin-login.ts):
 * ```typescript
 * import { createVercelHandler } from '@/lib/functions/adapters/node';
 * import { handleAdminLogin } from '@/lib/functions/handlers/admin-login';
 * 
 * export default createVercelHandler(async (req) => {
 *   const body = await req.json();
 *   const result = await handleAdminLogin(body);
 *   return Response.json(result);
 * });
 * ```
 * 
 * Usage for Netlify (netlify/functions/admin-login.ts):
 * ```typescript
 * import { createNetlifyHandler } from '@/lib/functions/adapters/node';
 * import { handleAdminLogin } from '@/lib/functions/handlers/admin-login';
 * 
 * export const handler = createNetlifyHandler(async (req) => {
 *   const body = await req.json();
 *   const result = await handleAdminLogin(body);
 *   return Response.json(result);
 * });
 * ```
 */

import { corsHeaders, type UniversalHandler } from '../runtime';

/**
 * Create a Vercel-compatible handler
 * Vercel supports the standard Web API Request/Response
 */
export function createVercelHandler(handler: UniversalHandler) {
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
 * Netlify Function handler type
 */
interface NetlifyContext {
  callbackWaitsForEmptyEventLoop?: boolean;
}

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string>;
  body: string | null;
  isBase64Encoded?: boolean;
  path: string;
  queryStringParameters?: Record<string, string>;
}

interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

/**
 * Create a Netlify-compatible handler
 * Netlify uses a different format than standard Web API
 */
export function createNetlifyHandler(handler: UniversalHandler) {
  return async (event: NetlifyEvent, context: NetlifyContext): Promise<NetlifyResponse> => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: '',
      };
    }

    try {
      // Convert Netlify event to standard Request
      const url = new URL(event.path, 'http://localhost');
      if (event.queryStringParameters) {
        Object.entries(event.queryStringParameters).forEach(([key, value]) => {
          if (value) url.searchParams.set(key, value);
        });
      }

      const request = new Request(url.toString(), {
        method: event.httpMethod,
        headers: event.headers,
        body: event.body && event.httpMethod !== 'GET' ? event.body : undefined,
      });

      const response = await handler(request);
      const body = await response.text();

      // Convert headers
      const headers: Record<string, string> = { ...corsHeaders };
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        statusCode: response.status,
        headers,
        body,
      };
    } catch (error) {
      console.error('Handler error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: message }),
      };
    }
  };
}

/**
 * Create an Express-compatible middleware
 * For use with Node.js/Express servers
 */
export function createExpressHandler(handler: UniversalHandler) {
  return async (req: any, res: any) => {
    try {
      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        Object.entries(corsHeaders).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        return res.status(200).end();
      }

      // Convert Express request to standard Request
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost';
      const url = new URL(req.originalUrl || req.url, `${protocol}://${host}`);

      const headers = new Headers();
      Object.entries(req.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers.set(key, value);
        }
      });

      let body: string | undefined;
      if (req.body && typeof req.body === 'object') {
        body = JSON.stringify(req.body);
      } else if (req.body) {
        body = req.body;
      }

      const request = new Request(url.toString(), {
        method: req.method,
        headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
      });

      const response = await handler(request);

      // Set headers
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      Object.entries(corsHeaders).forEach(([key, value]) => {
        if (!res.getHeader(key)) {
          res.setHeader(key, value);
        }
      });

      // Send response
      const responseBody = await response.text();
      res.status(response.status).send(responseBody);
    } catch (error) {
      console.error('Handler error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      res.status(500).json({ error: message });
    }
  };
}
