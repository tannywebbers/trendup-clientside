-- ============================================
-- TRIGGER: on_auth_user_created
-- Description: Fires after new user signup in auth.users
-- Creates profile, role, referral, and welcome bonus
-- ============================================

-- Drop existing trigger first for safe re-run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Automatically creates profile and role on user signup';
