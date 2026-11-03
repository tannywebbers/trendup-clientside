/**
 * Example: Netlify Serverless Function
 * 
 * This file demonstrates how to use the universal handler with Netlify.
 * Place this in `netlify/functions/admin-login.ts` in your Netlify project.
 * 
 * Note: You need to set environment variables in Netlify dashboard:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_ANON_KEY
 */

import { createNetlifyHandler } from '@/lib/functions/adapters/node';
import { handleAdminLogin } from '@/lib/functions/handlers/admin-login';
import type { AdminLoginRequest } from '@/lib/functions/types';

export const handler = createNetlifyHandler(async (req) => {
  const body: AdminLoginRequest = await req.json();
  const result = await handleAdminLogin(body);
  
  const status = result.success ? 200 : result.error === 'Invalid credentials' ? 401 : 400;
  
  return new Response(JSON.stringify(result), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
});
