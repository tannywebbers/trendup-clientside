# Universal Functions - Cross-Platform Deployment Guide

This directory contains platform-agnostic serverless function handlers that work across:
- **Lovable Cloud** (Supabase Edge Functions / Deno)
- **Vercel** (Edge Runtime or Node.js)
- **Netlify** (Functions)
- **Node.js / Express** (VPS hosting)
- **Local Development**

## Architecture

```
src/lib/functions/
├── runtime.ts          # Universal runtime utilities (env vars, CORS, etc.)
├── supabase.ts         # Supabase client factory
├── types.ts            # Shared TypeScript types
├── index.ts            # Main exports
├── handlers/           # Business logic (platform-agnostic)
│   ├── admin-login.ts
│   ├── totp-verify.ts
│   ├── paystack.ts
│   └── email.ts
├── adapters/           # Platform-specific wrappers
│   ├── deno.ts        # Supabase Edge Functions
│   └── node.ts        # Vercel/Netlify/Express
└── examples/           # Example implementations
    ├── vercel-admin-login.ts
    ├── netlify-admin-login.ts
    └── express-server.ts
```

## Key Principles

### 1. Universal Serverless Style
All handlers use standard Web APIs:
- `Request` and `Response` objects
- `fetch()` for HTTP requests
- `crypto.subtle` for cryptography

### 2. Environment Variables
Use the `getEnv()` helper that works across runtimes:
```typescript
import { getEnv, requireEnv } from './runtime';

const apiKey = getEnv('API_KEY'); // Returns undefined if not set
const required = requireEnv('REQUIRED_KEY'); // Throws if not set
```

### 3. Platform Adapters
Thin wrappers convert between platform-specific formats:

```typescript
// Vercel
import { createVercelHandler } from './adapters/node';
export default createVercelHandler(myHandler);

// Netlify  
import { createNetlifyHandler } from './adapters/node';
export const handler = createNetlifyHandler(myHandler);

// Express
import { createExpressHandler } from './adapters/node';
app.post('/api/endpoint', createExpressHandler(myHandler));

// Deno/Supabase (existing edge functions continue to work)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(myHandler);
```

## Deployment

### Lovable Cloud (Current)
The existing `supabase/functions/` directory continues to work unchanged.

### Vercel
1. Create `api/` directory
2. Copy examples from `examples/vercel-*.ts`
3. Set environment variables in Vercel dashboard
4. Deploy with `vercel deploy`

### Netlify
1. Create `netlify/functions/` directory
2. Copy examples from `examples/netlify-*.ts`
3. Set environment variables in Netlify dashboard
4. Deploy with `netlify deploy`

### VPS/Node.js
1. Set up Express server using `examples/express-server.ts` as guide
2. Set environment variables
3. Run with `node` or `pm2`

## Required Environment Variables

All platforms need these variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for server operations
- `SUPABASE_ANON_KEY` - Anonymous key for client operations
- `APP_URL` - Your app's public URL
- `PAYSTACK_SECRET_KEY` - (if using payments)

## Type Safety

All handlers have strongly typed request/response interfaces:
```typescript
import type { AdminLoginRequest, AdminLoginResponse } from './types';
```

## Adding New Handlers

1. Create handler in `handlers/`:
```typescript
// handlers/my-feature.ts
export async function handleMyFeature(body: MyRequest): Promise<MyResponse> {
  // Business logic here - no platform-specific code
}
```

2. Add types to `types.ts`
3. Export from `index.ts`
4. Use in any platform with the appropriate adapter
