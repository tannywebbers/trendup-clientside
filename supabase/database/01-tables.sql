-- ============================================
-- TABLES.SQL - All Database Tables
-- ============================================
-- Run this FIRST before functions, triggers, or policies
-- Safe to re-run: uses IF NOT EXISTS and safe ENUM creation
-- ============================================

-- ============================================
-- STEP 1: Create ENUM types BEFORE tables
-- ============================================

-- app_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END $$;

-- task_type enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
    CREATE TYPE public.task_type AS ENUM ('like', 'comment', 'save', 'watch', 'follow', 'combo_mini', 'combo_large');
  END IF;
END $$;

-- task_status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE public.task_status AS ENUM ('pending', 'approved', 'rejected', 'needs_review');
  END IF;
END $$;

-- ============================================
-- STEP 2: Core Tables (required for auth)
-- ============================================

-- PROFILES - User profile data (CRITICAL: auth trigger inserts here)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  first_name text,
  last_name text,
  tiktok_username text NOT NULL DEFAULT 'pending_username',
  tiktok_name text,
  country text,
  avatar_url text,
  tik_points integer NOT NULL DEFAULT 0,
  referral_code text UNIQUE,
  referred_by uuid REFERENCES public.profiles(id),
  display_name_changed_at timestamptz,
  is_banned boolean DEFAULT false,
  banned_at timestamptz,
  ban_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- USER_ROLES - Role assignments (CRITICAL: auth trigger inserts here)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- ============================================
-- STEP 3: Application Tables
-- ============================================

-- ADS - Task advertisements
CREATE TABLE IF NOT EXISTS public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  task_type public.task_type NOT NULL,
  tiktok_post_url text NOT NULL,
  video_description text,
  screenshot_example_url text,
  comment_keywords text[],
  points_per_task integer NOT NULL DEFAULT 10,
  required_completions integer NOT NULL DEFAULT 10,
  completed_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_creator_id ON public.ads(creator_id);
CREATE INDEX IF NOT EXISTS idx_ads_is_active ON public.ads(is_active);
CREATE INDEX IF NOT EXISTS idx_ads_task_type ON public.ads(task_type);

-- TASK_SUBMISSIONS - User task completions
CREATE TABLE IF NOT EXISTS public.task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  screenshot_urls text[] NOT NULL DEFAULT '{}',
  status public.task_status NOT NULL DEFAULT 'pending',
  ai_analysis jsonb,
  admin_notes text,
  points_awarded integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_submissions_user_id ON public.task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_ad_id ON public.task_submissions(ad_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_status ON public.task_submissions(status);

-- TRANSACTIONS - Point transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL,
  description text,
  reference_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);

-- REFERRALS - Referral relationships
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id),
  referred_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);

-- REFERRAL_COMMISSIONS - Commission tracking
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id),
  referred_id uuid NOT NULL REFERENCES public.profiles(id),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id),
  purchase_amount integer NOT NULL,
  commission_percentage numeric NOT NULL,
  commission_points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON public.referral_commissions(referrer_id);

-- NOTIFICATIONS - User notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  reference_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- ============================================
-- STEP 4: Chat Tables
-- ============================================

-- CHAT_SESSIONS - Support chat sessions
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'open',
  assigned_moderator_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON public.chat_sessions(status);

-- CHAT_MESSAGES - Individual messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_from_user boolean NOT NULL DEFAULT true,
  moderator_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);

-- ============================================
-- STEP 5: Settings & Config Tables
-- ============================================

-- APP_SETTINGS - Application-wide settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name text DEFAULT 'TikSwap',
  app_description text,
  logo_url text,
  favicon_url text,
  pwa_icon_url text,
  primary_color text DEFAULT '#8B5CF6',
  accent_color text DEFAULT '#10B981',
  meta_title text,
  meta_description text,
  support_email text,
  community_link text,
  community_label text DEFAULT 'Join Community',
  social_links jsonb DEFAULT '{}',
  platform_name text DEFAULT 'TikTok',
  platform_username_label text DEFAULT 'TikTok Username',
  platform_display_name_label text DEFAULT 'TikTok Display Name',
  points_name text DEFAULT 'TikPoints',
  points_short_name text DEFAULT 'TP',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- PLATFORM_SETTINGS - Key-value settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON public.platform_settings(key);

-- LANDING_CONTENT - CMS for landing page
CREATE TABLE IF NOT EXISTS public.landing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL,
  title text,
  subtitle text,
  content text,
  button_text text,
  button_url text,
  image_url text,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_content_section ON public.landing_content(section_key);

-- ============================================
-- STEP 6: Admin & Moderation Tables
-- ============================================

-- MODERATOR_PERMISSIONS - Moderator access control
CREATE TABLE IF NOT EXISTS public.moderator_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  can_review_submissions boolean NOT NULL DEFAULT true,
  can_manage_users boolean NOT NULL DEFAULT false,
  can_manage_chat boolean NOT NULL DEFAULT true,
  pages text[] NOT NULL DEFAULT '{}',
  is_suspended boolean NOT NULL DEFAULT false,
  suspend_reason text,
  suspended_at timestamptz,
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mod_permissions_user_id ON public.moderator_permissions(user_id);

-- MODERATOR_ACTIVITY_LOGS - Audit trail
CREATE TABLE IF NOT EXISTS public.moderator_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mod_logs_moderator ON public.moderator_activity_logs(moderator_id);
CREATE INDEX IF NOT EXISTS idx_mod_logs_created ON public.moderator_activity_logs(created_at);

-- ADMIN_TOTP_SECRETS - 2FA for admins
CREATE TABLE IF NOT EXISTS public.admin_totp_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  secret_encrypted text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  backup_codes text[],
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ADMIN_LOGIN_ATTEMPTS - Login audit
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid,
  ip_address text,
  is_successful boolean NOT NULL DEFAULT false,
  attempt_type text NOT NULL DEFAULT 'password',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_attempts_email ON public.admin_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_admin_attempts_created ON public.admin_login_attempts(created_at);

-- ============================================
-- STEP 7: Verification & Email Tables
-- ============================================

-- EMAIL_VERIFICATIONS - Email verification codes
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid,
  code text NOT NULL,
  verification_type text NOT NULL DEFAULT 'signup',
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON public.email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_code ON public.email_verifications(code);

-- FOLLOW_VERIFICATIONS - TikTok follow verifications
CREATE TABLE IF NOT EXISTS public.follow_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  submission_id uuid NOT NULL,
  ad_id uuid NOT NULL REFERENCES public.ads(id),
  performer_tiktok_username text NOT NULL,
  advertiser_tiktok_username text NOT NULL,
  initial_check_passed boolean NOT NULL DEFAULT false,
  initial_check_at timestamptz,
  scheduled_delay_check timestamptz,
  delay_check_passed boolean,
  delay_check_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_verifications_user ON public.follow_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_verifications_status ON public.follow_verifications(status);

-- GENERATED_COMMENTS - AI-generated comments
CREATE TABLE IF NOT EXISTS public.generated_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ad_id uuid NOT NULL REFERENCES public.ads(id),
  comment_text text NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_comments_ad ON public.generated_comments(ad_id);

-- ============================================
-- STEP 8: Configuration Tables
-- ============================================

-- AD_SETTINGS - Ad network configuration
CREATE TABLE IF NOT EXISTS public.ad_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_type text NOT NULL,
  placement text,
  ad_code text,
  is_enabled boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_settings_type ON public.ad_settings(ad_type);

-- ALLOWED_EMAIL_DOMAINS - Email domain whitelist
CREATE TABLE IF NOT EXISTS public.allowed_email_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SMTP_CONFIG - Email sending configuration
CREATE TABLE IF NOT EXISTS public.smtp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL,
  port integer NOT NULL DEFAULT 587,
  username text NOT NULL,
  smtp_password text,
  password_set boolean NOT NULL DEFAULT false,
  from_email text NOT NULL,
  from_name text NOT NULL DEFAULT 'TikSwap',
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AI_CONFIG - AI provider configuration
CREATE TABLE IF NOT EXISTS public.ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  api_key_set boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AI_PROMPTS - Custom AI prompts
CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_name text NOT NULL,
  task_type text NOT NULL,
  prompt_content text NOT NULL,
  confidence_threshold numeric NOT NULL DEFAULT 0.8,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- STEP 9: Enable RLS on all tables
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_totp_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DONE - Tables created successfully
-- ============================================
