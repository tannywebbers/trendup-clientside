-- ============================================
-- TABLE: profiles
-- Description: User profile data linked to auth.users
-- ============================================

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

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users';
COMMENT ON COLUMN public.profiles.tiktok_username IS 'Required field with default to prevent trigger failures';
