-- ============================================
-- TRIGGERS.SQL - All Database Triggers
-- ============================================
-- Run AFTER tables.sql and functions.sql
-- Safe to re-run: drops triggers before recreation
-- ============================================

-- ============================================
-- IMPORTANT: auth.users TRIGGER
-- ============================================
-- The trigger on auth.users MUST be run via:
-- 1. Supabase Dashboard > SQL Editor (has elevated permissions)
-- 2. NOT via client SDK (anon key has no permission)
--
-- WHY LOVABLE CLOUD WORKS BUT MANUAL DOESN'T:
-- - Lovable Cloud has internal service_role access
-- - Manual setup uses anon key which can't modify auth schema
--
-- SOLUTION: Run this SQL in Supabase Dashboard SQL Editor:
-- ============================================

-- Run this ONLY in Supabase Dashboard SQL Editor:
/*
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Automatically creates profile and role on user signup';
*/

-- ============================================
-- TRIGGERS: Auto-update timestamps
-- These CAN be run via client or dashboard
-- ============================================

-- Profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ads
DROP TRIGGER IF EXISTS update_ads_updated_at ON public.ads;
CREATE TRIGGER update_ads_updated_at
  BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Task Submissions
DROP TRIGGER IF EXISTS update_task_submissions_updated_at ON public.task_submissions;
CREATE TRIGGER update_task_submissions_updated_at
  BEFORE UPDATE ON public.task_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chat Sessions
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- App Settings
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_app_settings_timestamp();

-- Platform Settings
DROP TRIGGER IF EXISTS update_platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Landing Content
DROP TRIGGER IF EXISTS update_landing_content_updated_at ON public.landing_content;
CREATE TRIGGER update_landing_content_updated_at
  BEFORE UPDATE ON public.landing_content
  FOR EACH ROW EXECUTE FUNCTION public.update_landing_content_timestamp();

-- Moderator Permissions
DROP TRIGGER IF EXISTS update_moderator_permissions_updated_at ON public.moderator_permissions;
CREATE TRIGGER update_moderator_permissions_updated_at
  BEFORE UPDATE ON public.moderator_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin TOTP Secrets
DROP TRIGGER IF EXISTS update_admin_totp_secrets_updated_at ON public.admin_totp_secrets;
CREATE TRIGGER update_admin_totp_secrets_updated_at
  BEFORE UPDATE ON public.admin_totp_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SMTP Config
DROP TRIGGER IF EXISTS update_smtp_config_updated_at ON public.smtp_config;
CREATE TRIGGER update_smtp_config_updated_at
  BEFORE UPDATE ON public.smtp_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI Config
DROP TRIGGER IF EXISTS update_ai_config_updated_at ON public.ai_config;
CREATE TRIGGER update_ai_config_updated_at
  BEFORE UPDATE ON public.ai_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI Prompts
DROP TRIGGER IF EXISTS update_ai_prompts_updated_at ON public.ai_prompts;
CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ad Settings
DROP TRIGGER IF EXISTS update_ad_settings_updated_at ON public.ad_settings;
CREATE TRIGGER update_ad_settings_updated_at
  BEFORE UPDATE ON public.ad_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- DONE - Triggers created successfully
-- ============================================
