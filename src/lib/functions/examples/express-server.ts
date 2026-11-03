/**
 * Example: Express.js Server Integration
 * 
 * This file demonstrates how to use the universal handlers with an Express server.
 * This is useful for VPS hosting or local development with a Node.js server.
 * 
 * Usage:
 * ```
 * npm install express
 * npx ts-node examples/express-server.ts
 * ```
 * 
 * Note: You need to set environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_ANON_KEY
 */

import { createExpressHandler } from '@/lib/functions/adapters/node';
import { handleAdminLogin } from '@/lib/functions/handlers/admin-login';
import { handleTOTPVerify } from '@/lib/functions/handlers/totp-verify';
import { handlePaystackInitialize, handlePaystackWebhook } from '@/lib/functions/handlers/paystack';
import { handleSendVerificationEmail, handleTestSMTP } from '@/lib/functions/handlers/email';

// Note: In a real Express setup, you would do:
// import express from 'express';
// const app = express();

/**
 * Example Express route configuration:
 * 
 * ```typescript
 * import express from 'express';
 * 
 * const app = express();
 * app.use(express.json());
 * 
 * // Admin login
 * app.post('/api/admin-login', createExpressHandler(async (req) => {
 *   const body = await req.json();
 *   const result = await handleAdminLogin(body);
 *   return new Response(JSON.stringify(result), {
 *     status: result.success ? 200 : 401,
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * }));
 * 
 * // TOTP Verification
 * app.post('/api/totp-verify', createExpressHandler(async (req) => {
 *   const body = await req.json();
 *   const result = await handleTOTPVerify(body);
 *   return new Response(JSON.stringify(result), {
 *     status: result.success || !result.error ? 200 : 400,
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * }));
 * 
 * // Payment initialization
 * app.post('/api/paystack/initialize', createExpressHandler(async (req) => {
 *   const body = await req.json();
 *   const result = await handlePaystackInitialize(body);
 *   return new Response(JSON.stringify(result), {
 *     status: result.error ? 400 : 200,
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * }));
 * 
 * // Webhook (raw body needed for signature verification)
 * app.post('/api/paystack/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
 *   const signature = req.headers['x-paystack-signature'] as string | undefined;
 *   const result = await handlePaystackWebhook(req.body.toString(), signature || null);
 *   res.status(result.success ? 200 : 400).json(result);
 * });
 * 
 * // Email verification
 * app.post('/api/send-verification-email', createExpressHandler(async (req) => {
 *   const body = await req.json();
 *   const result = await handleSendVerificationEmail(body);
 *   return new Response(JSON.stringify(result), {
 *     status: result.success ? 200 : 400,
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * }));
 * 
 * app.listen(3000, () => {
 *   console.log('Server running on http://localhost:3000');
 * });
 * ```
 */

export {
  createExpressHandler,
  handleAdminLogin,
  handleTOTPVerify,
  handlePaystackInitialize,
  handlePaystackWebhook,
  handleSendVerificationEmail,
  handleTestSMTP,
};
