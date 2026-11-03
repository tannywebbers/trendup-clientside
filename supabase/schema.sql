-- ============================================================================
-- TikPoints Complete Database Schema
-- ============================================================================
-- This file contains the complete database schema for the TikPoints application.
-- It can be run safely multiple times - uses IF NOT EXISTS and CREATE OR REPLACE.
--
-- USAGE:
-- 1. Auto-applied on app initialization (validation only - client can't execute DDL)
-- 2. Manual execution in Supabase SQL Editor if tables are missing
--
-- IMPORTANT: Run this with a service role key or in the SQL Editor
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CUSTOM TYPES (ENUMS)
-- ============================================================================

-- App role enum for user roles
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Task status enum
DO $$ BEGIN
    CREATE TYPE public.task_status AS ENUM ('pending', 'approved', 'rejected', 'needs_review');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Task type enum
DO $$ BEGIN
    CREATE TYPE public.task_type AS ENUM ('like', 'comment', 'save', 'watch', 'follow', 'combo_mini', 'combo_large');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    email text NOT NULL,
    first_name text,
    last_name text,
    tiktok_username text NOT NULL,
    tiktok_name text,
    country text,
    avatar_url text,
    tik_points integer NOT NULL DEFAULT 0,
    referral_code text UNIQUE,
    referred_by uuid REFERENCES public.profiles(id),
    is_banned boolean DEFAULT false,
    ban_reason text,
    banned_at timestamp with time zone,
    display_name_changed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User roles (separate table for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role public.app_role NOT NULL DEFAULT 'user'::public.app_role,
    UNIQUE (user_id, role)
);

-- Ads/Tasks created by users
CREATE TABLE IF NOT EXISTS public.ads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id uuid NOT NULL,
    tiktok_post_url text NOT NULL,
    video_description text,
    task_type public.task_type NOT NULL,
    points_per_task integer NOT NULL DEFAULT 10,
    required_completions integer NOT NULL DEFAULT 10,
    completed_count integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    screenshot_example_url text,
    comment_keywords text[],
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Task submissions
CREATE TABLE IF NOT EXISTS public.task_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id uuid NOT NULL REFERENCES public.ads(id),
    user_id uuid NOT NULL,
    screenshot_urls text[] NOT NULL DEFAULT '{}',
    status public.task_status NOT NULL DEFAULT 'pending'::public.task_status,
    ai_analysis jsonb,
    admin_notes text,
    points_awarded integer,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Transactions (points history)
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    type text NOT NULL,
    description text,
    reference_id text UNIQUE,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id uuid NOT NULL REFERENCES public.profiles(id),
    referred_id uuid NOT NULL REFERENCES public.profiles(id) UNIQUE,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Referral commissions
CREATE TABLE IF NOT EXISTS public.referral_commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id uuid NOT NULL REFERENCES public.profiles(id),
    referred_id uuid NOT NULL REFERENCES public.profiles(id),
    transaction_id uuid NOT NULL REFERENCES public.transactions(id) UNIQUE,
    purchase_amount integer NOT NULL,
    commission_percentage numeric NOT NULL,
    commission_points integer NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    reference_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================================================
-- CHAT TABLES
-- ============================================================================

-- Chat sessions
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    assigned_moderator_id uuid,
    subject text,
    status text NOT NULL DEFAULT 'open',
    closed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    moderator_id uuid,
    message text NOT NULL,
    is_from_user boolean NOT NULL DEFAULT true,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================================================
-- ADMIN/MODERATOR TABLES
-- ============================================================================

-- Moderator permissions
CREATE TABLE IF NOT EXISTS public.moderator_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    pages text[] NOT NULL DEFAULT '{}',
    can_manage_chat boolean NOT NULL DEFAULT true,
    can_review_submissions boolean NOT NULL DEFAULT false,
    can_manage_users boolean NOT NULL DEFAULT false,
    is_suspended boolean NOT NULL DEFAULT false,
    suspend_reason text,
    suspended_at timestamp with time zone,
    invited_by uuid,
    invited_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Moderator activity logs
CREATE TABLE IF NOT EXISTS public.moderator_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    moderator_id uuid NOT NULL,
    action text NOT NULL,
    target_type text,
    target_id text,
    details jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Admin TOTP secrets (2FA)
CREATE TABLE IF NOT EXISTS public.admin_totp_secrets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    secret_encrypted text NOT NULL,
    backup_codes text[],
    is_verified boolean NOT NULL DEFAULT false,
    failed_attempts integer NOT NULL DEFAULT 0,
    locked_until timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Admin login attempts
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    user_id uuid,
    ip_address text,
    attempt_type text NOT NULL DEFAULT 'password',
    is_successful boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================================================
-- VERIFICATION TABLES
-- ============================================================================

-- Email verifications
CREATE TABLE IF NOT EXISTS public.email_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    user_id uuid,
    code text NOT NULL,
    verification_type text NOT NULL DEFAULT 'code',
    expires_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Follow verifications
CREATE TABLE IF NOT EXISTS public.follow_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id uuid NOT NULL,
    ad_id uuid NOT NULL REFERENCES public.ads(id),
    user_id uuid NOT NULL,
    performer_tiktok_username text NOT NULL,
    advertiser_tiktok_username text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    initial_check_passed boolean NOT NULL DEFAULT false,
    initial_check_at timestamp with time zone,
    scheduled_delay_check timestamp with time zone,
    delay_check_passed boolean,
    delay_check_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Generated comments for tasks
CREATE TABLE IF NOT EXISTS public.generated_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id uuid NOT NULL REFERENCES public.ads(id),
    user_id uuid NOT NULL,
    comment_text text NOT NULL,
    is_used boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================================================
-- CONFIGURATION TABLES
-- ============================================================================

-- App settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name text DEFAULT 'TikPoints',
    app_description text DEFAULT 'Earn points by engaging with TikTok content',
    meta_title text DEFAULT 'TikPoints - TikTok Engagement Exchange',
    meta_description text DEFAULT 'The leading platform for TikTok engagement exchange. Earn and advertise smarter.',
    logo_url text,
    favicon_url text,
    pwa_icon_url text,
    primary_color text DEFAULT '#ec4899',
    accent_color text DEFAULT '#06b6d4',
    platform_name text DEFAULT 'TikTok',
    platform_username_label text DEFAULT 'TikTok Username',
    platform_display_name_label text DEFAULT 'TikTok Display Name',
    points_name text DEFAULT 'TikPoints',
    points_short_name text DEFAULT 'pts',
    community_label text DEFAULT 'Community',
    community_link text DEFAULT '',
    support_email text DEFAULT '',
    social_links jsonb DEFAULT '{"tiktok": "", "twitter": "", "youtube": "", "facebook": "", "instagram": ""}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Platform settings (key-value store)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Ad settings (for third-party ads)
CREATE TABLE IF NOT EXISTS public.ad_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_type text NOT NULL,
    ad_code text DEFAULT '',
    placement text DEFAULT '',
    is_enabled boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Allowed email domains
CREATE TABLE IF NOT EXISTS public.allowed_email_domains (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    domain text NOT NULL UNIQUE,
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Landing page content
CREATE TABLE IF NOT EXISTS public.landing_content (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    section_key text NOT NULL,
    title text,
    subtitle text,
    content text,
    image_url text,
    button_text text,
    button_url text,
    is_visible boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- SMTP configuration
CREATE TABLE IF NOT EXISTS public.smtp_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    host text NOT NULL,
    port integer NOT NULL DEFAULT 587,
    username text NOT NULL,
    smtp_password text,
    password_set boolean NOT NULL DEFAULT false,
    from_email text NOT NULL,
    from_name text NOT NULL DEFAULT 'TikPoints',
    is_enabled boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- AI configuration
CREATE TABLE IF NOT EXISTS public.ai_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    api_key_set boolean NOT NULL DEFAULT false,
    is_enabled boolean NOT NULL DEFAULT false,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- AI prompts
CREATE TABLE IF NOT EXISTS public.ai_prompts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_name text NOT NULL,
    task_type text NOT NULL,
    prompt_content text NOT NULL,
    confidence_threshold integer NOT NULL DEFAULT 70,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Check if user has a specific role (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update app_settings timestamp
CREATE OR REPLACE FUNCTION public.update_app_settings_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update landing_content timestamp
CREATE OR REPLACE FUNCTION public.update_landing_content_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Credit purchase points (atomic transaction)
CREATE OR REPLACE FUNCTION public.credit_purchase_points(
  _user_id uuid,
  _points integer,
  _amount_paid numeric,
  _reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_tx_id uuid;
  new_balance integer;
  referrer_profile_id uuid;
  user_profile_id uuid;
  commission_pct numeric;
  commission_pts integer;
BEGIN
  IF _user_id IS NULL OR _reference IS NULL OR length(trim(_reference)) = 0 THEN
    RAISE EXCEPTION 'Missing user_id or reference';
  END IF;

  IF _points IS NULL OR _points <= 0 THEN
    RAISE EXCEPTION 'Invalid points';
  END IF;

  -- Insert transaction first; if already present, treat as already processed
  INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
  VALUES (
    _user_id,
    _points,
    'purchase',
    format('Purchased %s TikPoints for ₦%s', _points, _amount_paid),
    _reference
  )
  ON CONFLICT (reference_id) DO NOTHING
  RETURNING id INTO inserted_tx_id;

  IF inserted_tx_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  -- Update user's balance
  UPDATE public.profiles
  SET tik_points = tik_points + _points
  WHERE user_id = _user_id
  RETURNING tik_points, id, referred_by INTO new_balance, user_profile_id, referrer_profile_id;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user_id %', _user_id;
  END IF;

  -- Handle referral commission if user was referred
  IF referrer_profile_id IS NOT NULL THEN
    SELECT COALESCE((value->>'referral_commission_percentage')::numeric, 0)
    INTO commission_pct
    FROM public.platform_settings
    WHERE key = 'bonus_settings';
    
    IF commission_pct > 0 THEN
      commission_pts := floor(_points * (commission_pct / 100));
      
      IF commission_pts > 0 THEN
        UPDATE public.profiles
        SET tik_points = tik_points + commission_pts
        WHERE id = referrer_profile_id;
        
        INSERT INTO public.referral_commissions (
          referrer_id, referred_id, transaction_id, purchase_amount, 
          commission_percentage, commission_points
        )
        VALUES (
          referrer_profile_id, user_profile_id, inserted_tx_id, 
          _points, commission_pct, commission_pts
        );
        
        INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
        SELECT p.user_id, commission_pts, 'referral_commission', 
               format('Referral commission (%s%%) from referred user purchase', commission_pct),
               _reference || '_commission'
        FROM public.profiles p
        WHERE p.id = referrer_profile_id;
        
        INSERT INTO public.notifications (user_id, type, title, message)
        SELECT p.user_id, 'points_earned', 'Referral Commission!',
               format('You earned %s TikPoints from a referred user purchase!', commission_pts)
        FROM public.profiles p
        WHERE p.id = referrer_profile_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, reference_id)
  VALUES (
    _user_id,
    'points_earned',
    'Points Purchased!',
    format('You successfully purchased %s TikPoints.', _points),
    NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'transaction_id', inserted_tx_id,
    'new_balance', new_balance
  );
END;
$$;

-- Handle new user signup (creates profile and assigns role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  initial_role public.app_role;
  animal_avatars text[];
  random_avatar text;
  new_referral_code text;
  referrer_profile_id uuid;
  welcome_bonus_amount integer;
  referral_param text;
BEGIN
  animal_avatars := ARRAY['🦊', '🐼', '🦁', '🐯', '🐻', '🐨', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🐺', '🐗', '🐴', '🦄', '🐝', '🦋', '🐌', '🐢', '🐍', '🦎', '🦖', '🐙', '🦀', '🐠', '🐬', '🦈', '🐳'];
  
  random_avatar := animal_avatars[1 + floor(random() * array_length(animal_avatars, 1))::int];
  new_referral_code := upper(substring(replace(NEW.id::text, '-', '') from 1 for 8));
  
  SELECT COALESCE((value->>'welcome_bonus')::integer, 0)
  INTO welcome_bonus_amount
  FROM public.platform_settings
  WHERE key = 'bonus_settings';
  
  referral_param := NEW.raw_user_meta_data->>'referral_code';
  
  IF referral_param IS NOT NULL AND referral_param != '' THEN
    SELECT id INTO referrer_profile_id
    FROM public.profiles
    WHERE referral_code = upper(referral_param);
  END IF;
  
  INSERT INTO public.profiles (
    user_id, email, first_name, last_name, tiktok_username, 
    tiktok_name, avatar_url, country, referral_code, referred_by, tik_points
  )
  VALUES (
    NEW.id, NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'tiktok_username', ''), 'user_' || left(replace(NEW.id::text, '-', ''), 10)),
    NEW.raw_user_meta_data ->> 'tiktok_name',
    random_avatar,
    NEW.raw_user_meta_data ->> 'country',
    new_referral_code,
    referrer_profile_id,
    COALESCE(welcome_bonus_amount, 0)
  );

  IF referrer_profile_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id)
    SELECT referrer_profile_id, p.id
    FROM public.profiles p
    WHERE p.user_id = NEW.id;
  END IF;

  IF welcome_bonus_amount > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (NEW.id, welcome_bonus_amount, 'bonus', 'Welcome bonus');
    
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (NEW.id, 'points_earned', 'Welcome Bonus!',
            format('You received %s TikPoints as a welcome bonus!', welcome_bonus_amount));
  END IF;

  IF lower(NEW.email) = 'admin@tikswap.online' THEN
    initial_role := 'admin'::public.app_role;
  ELSE
    initial_role := 'user'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, initial_role);

  RETURN NEW;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Drop existing triggers before recreating
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_ads_updated_at ON public.ads;
DROP TRIGGER IF EXISTS update_task_submissions_updated_at ON public.task_submissions;
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON public.chat_sessions;
DROP TRIGGER IF EXISTS update_moderator_permissions_updated_at ON public.moderator_permissions;
DROP TRIGGER IF EXISTS update_admin_totp_secrets_updated_at ON public.admin_totp_secrets;
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
DROP TRIGGER IF EXISTS update_ad_settings_updated_at ON public.ad_settings;
DROP TRIGGER IF EXISTS update_landing_content_updated_at ON public.landing_content;
DROP TRIGGER IF EXISTS update_smtp_config_updated_at ON public.smtp_config;
DROP TRIGGER IF EXISTS update_ai_config_updated_at ON public.ai_config;
DROP TRIGGER IF EXISTS update_ai_prompts_updated_at ON public.ai_prompts;

-- Create new user trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers for all tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ads_updated_at
  BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_submissions_updated_at
  BEFORE UPDATE ON public.task_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_moderator_permissions_updated_at
  BEFORE UPDATE ON public.moderator_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_totp_secrets_updated_at
  BEFORE UPDATE ON public.admin_totp_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_app_settings_timestamp();

CREATE TRIGGER update_ad_settings_updated_at
  BEFORE UPDATE ON public.ad_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landing_content_updated_at
  BEFORE UPDATE ON public.landing_content
  FOR EACH ROW EXECUTE FUNCTION public.update_landing_content_timestamp();

CREATE TRIGGER update_smtp_config_updated_at
  BEFORE UPDATE ON public.smtp_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_config_updated_at
  BEFORE UPDATE ON public.ai_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
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
ALTER TABLE public.moderator_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderator_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_totp_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- User roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Ads policies
DROP POLICY IF EXISTS "Anyone can view active ads" ON public.ads;
DROP POLICY IF EXISTS "Users can create ads" ON public.ads;
DROP POLICY IF EXISTS "Users can update own ads" ON public.ads;
DROP POLICY IF EXISTS "Admins can manage all ads" ON public.ads;

CREATE POLICY "Anyone can view active ads" ON public.ads
  FOR SELECT USING ((is_active = true) OR (auth.uid() = creator_id));

CREATE POLICY "Users can create ads" ON public.ads
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own ads" ON public.ads
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Admins can manage all ads" ON public.ads
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Task submissions policies
DROP POLICY IF EXISTS "Users can view own submissions" ON public.task_submissions;
DROP POLICY IF EXISTS "Users can create submissions" ON public.task_submissions;
DROP POLICY IF EXISTS "Ad creators can view submissions" ON public.task_submissions;
DROP POLICY IF EXISTS "Admins can manage all submissions" ON public.task_submissions;

CREATE POLICY "Users can view own submissions" ON public.task_submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create submissions" ON public.task_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Ad creators can view submissions" ON public.task_submissions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM ads WHERE ads.id = task_submissions.ad_id AND ads.creator_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all submissions" ON public.task_submissions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Transactions policies
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all transactions" ON public.transactions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Referrals policies
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
DROP POLICY IF EXISTS "Admins can manage referrals" ON public.referrals;

CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() IN (
    SELECT user_id FROM profiles WHERE profiles.id = referrals.referrer_id
  ));

CREATE POLICY "System can insert referrals" ON public.referrals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage referrals" ON public.referrals
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Referral commissions policies
DROP POLICY IF EXISTS "Users can view own commissions" ON public.referral_commissions;
DROP POLICY IF EXISTS "System can insert commissions" ON public.referral_commissions;
DROP POLICY IF EXISTS "Admins can manage commissions" ON public.referral_commissions;

CREATE POLICY "Users can view own commissions" ON public.referral_commissions
  FOR SELECT USING (auth.uid() IN (
    SELECT user_id FROM profiles WHERE profiles.id = referral_commissions.referrer_id
  ));

CREATE POLICY "System can insert commissions" ON public.referral_commissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage commissions" ON public.referral_commissions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Chat sessions policies
DROP POLICY IF EXISTS "Users can view own chat session" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can create own chat session" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat session" ON public.chat_sessions;

CREATE POLICY "Users can view own chat session" ON public.chat_sessions
  FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can create own chat session" ON public.chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat session" ON public.chat_sessions
  FOR UPDATE USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Chat messages policies
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Moderators can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Moderators can update messages" ON public.chat_messages;

CREATE POLICY "Users can view own chat messages" ON public.chat_messages
  FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can send chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Moderators can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can update messages" ON public.chat_messages
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Moderator permissions policies
DROP POLICY IF EXISTS "Moderators can view own permissions" ON public.moderator_permissions;
DROP POLICY IF EXISTS "Admins can manage moderator permissions" ON public.moderator_permissions;

CREATE POLICY "Moderators can view own permissions" ON public.moderator_permissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage moderator permissions" ON public.moderator_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Moderator activity logs policies
DROP POLICY IF EXISTS "Moderators can view own activity" ON public.moderator_activity_logs;
DROP POLICY IF EXISTS "Admins can view all activity" ON public.moderator_activity_logs;
DROP POLICY IF EXISTS "System can insert activity" ON public.moderator_activity_logs;

CREATE POLICY "Moderators can view own activity" ON public.moderator_activity_logs
  FOR SELECT USING (auth.uid() = moderator_id);

CREATE POLICY "Admins can view all activity" ON public.moderator_activity_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert activity" ON public.moderator_activity_logs
  FOR INSERT WITH CHECK (true);

-- Admin TOTP secrets policies
DROP POLICY IF EXISTS "Users can view own TOTP secret" ON public.admin_totp_secrets;
DROP POLICY IF EXISTS "System can manage TOTP secrets" ON public.admin_totp_secrets;

CREATE POLICY "Users can view own TOTP secret" ON public.admin_totp_secrets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage TOTP secrets" ON public.admin_totp_secrets
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin login attempts policies
DROP POLICY IF EXISTS "Admins can view login attempts" ON public.admin_login_attempts;
DROP POLICY IF EXISTS "System can manage login attempts" ON public.admin_login_attempts;

CREATE POLICY "Admins can view login attempts" ON public.admin_login_attempts
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can manage login attempts" ON public.admin_login_attempts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Email verifications policies
DROP POLICY IF EXISTS "Public insert for verification" ON public.email_verifications;
DROP POLICY IF EXISTS "Users can view own verifications" ON public.email_verifications;

CREATE POLICY "Public insert for verification" ON public.email_verifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own verifications" ON public.email_verifications
  FOR SELECT USING (email = (current_setting('request.jwt.claims', true)::json ->> 'email'));

-- Follow verifications policies
DROP POLICY IF EXISTS "Users can view own follow verifications" ON public.follow_verifications;
DROP POLICY IF EXISTS "System can manage follow verifications" ON public.follow_verifications;

CREATE POLICY "Users can view own follow verifications" ON public.follow_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage follow verifications" ON public.follow_verifications
  FOR ALL USING (true);

-- Generated comments policies
DROP POLICY IF EXISTS "Users can view own comments" ON public.generated_comments;
DROP POLICY IF EXISTS "System can insert comments" ON public.generated_comments;

CREATE POLICY "Users can view own comments" ON public.generated_comments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert comments" ON public.generated_comments
  FOR INSERT WITH CHECK (true);

-- App settings policies
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;

CREATE POLICY "Anyone can read app settings" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update app settings" ON public.app_settings
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Platform settings policies
DROP POLICY IF EXISTS "Anyone can read settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.platform_settings;

CREATE POLICY "Anyone can read settings" ON public.platform_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON public.platform_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Ad settings policies
DROP POLICY IF EXISTS "Anyone can read ad settings" ON public.ad_settings;
DROP POLICY IF EXISTS "Admins can manage ad settings" ON public.ad_settings;

CREATE POLICY "Anyone can read ad settings" ON public.ad_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage ad settings" ON public.ad_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Allowed email domains policies
DROP POLICY IF EXISTS "Anyone can read allowed domains" ON public.allowed_email_domains;
DROP POLICY IF EXISTS "Admins can manage domains" ON public.allowed_email_domains;

CREATE POLICY "Anyone can read allowed domains" ON public.allowed_email_domains
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage domains" ON public.allowed_email_domains
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Landing content policies
DROP POLICY IF EXISTS "Anyone can view landing content" ON public.landing_content;
DROP POLICY IF EXISTS "Admins can manage landing content" ON public.landing_content;

CREATE POLICY "Anyone can view landing content" ON public.landing_content
  FOR SELECT USING (is_visible = true);

CREATE POLICY "Admins can manage landing content" ON public.landing_content
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- SMTP config policies
DROP POLICY IF EXISTS "Admins can manage SMTP config" ON public.smtp_config;

CREATE POLICY "Admins can manage SMTP config" ON public.smtp_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- AI config policies
DROP POLICY IF EXISTS "Admins can view AI config" ON public.ai_config;
DROP POLICY IF EXISTS "Admins can manage AI config" ON public.ai_config;

CREATE POLICY "Admins can view AI config" ON public.ai_config
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage AI config" ON public.ai_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- AI prompts policies
DROP POLICY IF EXISTS "Anyone can read active prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Admins can manage prompts" ON public.ai_prompts;

CREATE POLICY "Anyone can read active prompts" ON public.ai_prompts
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage prompts" ON public.ai_prompts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Insert default app settings if not exists
INSERT INTO public.app_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings LIMIT 1);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_creator_id ON public.ads(creator_id);
CREATE INDEX IF NOT EXISTS idx_ads_is_active ON public.ads(is_active);
CREATE INDEX IF NOT EXISTS idx_task_submissions_user_id ON public.task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_ad_id ON public.task_submissions(ad_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_status ON public.task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_id ON public.transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);

-- ============================================================================
-- SCHEMA VERSION
-- ============================================================================

-- Track schema version for future migrations
CREATE TABLE IF NOT EXISTS public.schema_version (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version text NOT NULL,
    applied_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.schema_version (version)
SELECT '1.0.0'
WHERE NOT EXISTS (SELECT 1 FROM public.schema_version WHERE version = '1.0.0');

-- Enable RLS on schema_version
ALTER TABLE public.schema_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read schema version" ON public.schema_version
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage schema version" ON public.schema_version
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
