/**
 * Example: Vercel Serverless Function
 * 
 * This file demonstrates how to use the universal handler with Vercel.
 * Place this in `api/admin-login.ts` in your Vercel project.
 * 
 * Note: You need to set environment variables in Vercel dashboard:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_ANON_KEY
 */

import { createVercelHandler } from '@/lib/functions/adapters/node';
import { handleAdminLogin } from '@/lib/functions/handlers/admin-login';
import type { AdminLoginRequest } from '@/lib/functions/types';

export const config = {
  runtime: 'edge', // Use Edge Runtime for best performance
};

export default createVercelHandler(async (req) => {
  const body: AdminLoginRequest = await req.json();
  const result = await handleAdminLogin(body);
  
  const status = result.success ? 200 : result.error === 'Invalid credentials' ? 401 : 400;
  
  return new Response(JSON.stringify(result), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
});
