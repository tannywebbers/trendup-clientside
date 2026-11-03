-- ============================================
-- TRIGGERS.SQL - All Database Triggers
-- ============================================
-- Run AFTER tables.sql AND functions.sql
-- Safe to re-run: drops triggers before recreation
-- ============================================
-- 
-- ⚠️  RUN THIS IN SUPABASE DASHBOARD > SQL EDITOR
--     (not via anon key / client SDK)
--
-- The auth.users trigger is handled separately in
-- auth_trigger.sql — see that file for instructions.
-- ============================================

-- ============================================
-- Timestamp triggers (BEFORE UPDATE)
-- These auto-set updated_at = now() on every row update
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
