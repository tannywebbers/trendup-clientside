# TikSwap - TikTok Engagement Platform

## Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables (see below)
4. Run development server: `npm run dev`

## Environment Variables

Create a `.env` file with the following variables:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

## Database Setup

This project uses a modular SQL architecture for maximum reliability.

### SQL Files Location

All database SQL files are in `supabase/database/`:

| File | Description | Order |
|------|-------------|-------|
| `01-tables.sql` | All table definitions with ENUMs | 1st |
| `02-functions.sql` | Database functions (auth trigger, helpers) | 2nd |
| `03-triggers.sql` | All triggers including auth user creation | 3rd |
| `04-rls.sql` | Row Level Security policies | 4th |

### Auto-Creation

When the app connects to Supabase:
1. It validates all required tables exist
2. Logs status to console with `[DB INIT]` prefix
3. If tables are missing, logs warnings with instructions

### Manual Setup

If auto-creation fails or you're setting up a new Supabase project:

1. Open Supabase SQL Editor
2. Run files in order:
   - `01-tables.sql` (creates all tables)
   - `02-functions.sql` (creates auth trigger function)
   - `03-triggers.sql` (attaches trigger to auth.users)
   - `04-rls.sql` (enables security policies)

### Database Diagnostics

Visit `/baki/stage/admin/db` for:
- Real-time connection status
- Table existence checks
- Auth trigger health
- Diagnostic logs
- SQL file execution guide

## Architecture

### Auth Flow

1. User signs up via Supabase Auth
2. Trigger `on_auth_user_created` fires on `auth.users`
3. Trigger calls `handle_new_user()` function
4. Function creates:
   - Profile row in `profiles` table
   - Role row in `user_roles` table
   - Optional referral record
   - Welcome bonus transaction

### Key Tables

- `profiles` - User profile data (linked to auth.users)
- `user_roles` - Role assignments (admin, moderator, user)
- `ads` - Task advertisements
- `task_submissions` - User task completions
- `transactions` - Point transactions
- `referrals` - Referral relationships

### Safety Features

- All NOT NULL columns have DEFAULT values
- Auth trigger has comprehensive exception handling
- ENUMs are created before tables that use them
- All SQL is idempotent (safe to re-run)

## Technologies

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **State Management**: TanStack Query

## Project Structure

```
src/
├── components/       # React components
│   ├── ads/         # Ad-related components
│   ├── dashboard/   # Dashboard pages
│   ├── landing/     # Landing page sections
│   └── ui/          # shadcn/ui components
├── hooks/           # Custom React hooks
├── lib/             # Utilities and services
│   └── db/          # Database initialization
├── pages/           # Page components
│   └── admin/       # Admin panel pages
└── integrations/    # Third-party integrations
    └── supabase/    # Supabase client & types

supabase/
├── database/        # SQL files for manual execution
│   ├── 01-tables.sql
│   ├── 02-functions.sql
│   ├── 03-triggers.sql
│   └── 04-rls.sql
├── functions/       # Edge functions
└── schema-sql/      # Modular SQL reference (legacy)
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Deployment

1. Push code to repository
2. Lovable auto-deploys to preview URL
3. Click "Publish" for production deployment

## Troubleshooting

### Auth Signup Fails (HTTP 500)

1. Visit `/baki/stage/admin/db` to check database status
2. Ensure all tables exist
3. Run `02-functions.sql` to fix the auth trigger
4. Run `03-triggers.sql` to attach the trigger

### Missing Tables

Run `01-tables.sql` in Supabase SQL Editor

### RLS Blocking Access

Run `04-rls.sql` to reset all policies

## License

Private - All rights reserved
