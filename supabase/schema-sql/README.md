# Database Schema Documentation

This directory contains modular SQL files for the database schema. Each section can be run independently in the correct order.

## Execution Order

1. **Tables** (`tables/`) - Run first
2. **Functions** (`functions/`) - Run second  
3. **Triggers** (`triggers/`) - Run third
4. **Policies** (`policies/`) - Run last

## Quick Start

If you need to set up the database from scratch:

```sql
-- Run in this order in Supabase SQL Editor:
-- 1. All files in tables/
-- 2. All files in functions/
-- 3. All files in triggers/
-- 4. All files in policies/
```

## Important Notes

- All tables use `IF NOT EXISTS` for safe re-runs
- All functions use `CREATE OR REPLACE`
- Triggers are dropped before recreation
- RLS policies are created after tables

## Auth Flow

When a user signs up:
1. Supabase creates entry in `auth.users`
2. Trigger `on_auth_user_created` fires
3. Trigger calls `handle_new_user()` function
4. Function creates profile, user_role, and optional referral

## Safety Features

- `tiktok_username` has a default value to prevent NULL errors
- `handle_new_user` has exception handling to prevent auth rollback
- All NOT NULL columns either have defaults or are populated by triggers
