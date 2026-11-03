-- ============================================================
-- AUTH_TRIGGER.SQL
-- ============================================================
-- ⚠️  THIS MUST BE RUN IN: Supabase Dashboard > SQL Editor
-- ⚠️  Do NOT run via client SDK or anon key — it will fail.
--
-- WHY DASHBOARD ONLY?
--   auth.users is owned by Supabase internally.
--   Only the Dashboard SQL Editor runs as a privileged role
--   that can attach triggers to it.
--
-- PREREQUISITES:
--   1. tables.sql must have been run already.
--   2. functions.sql must have been run already.
--      (handle_new_user is defined there — do NOT redefine it here.)
--
-- STEPS:
--   1. Open Supabase Dashboard
--   2. Go to SQL Editor
--   3. Paste this entire file
--   4. Click Run
-- ============================================================

-- Drop the old trigger first (safe no-op if it doesn't exist)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Attach the trigger. The function public.handle_new_user() is
-- defined in functions.sql with SECURITY DEFINER so it
-- automatically bypasses RLS on profiles, user_roles, etc.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DONE. New signups will now auto-create profiles + roles.
-- ============================================================
