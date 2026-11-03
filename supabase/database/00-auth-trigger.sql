-- ============================================
-- AUTH TRIGGER - RUN IN SUPABASE DASHBOARD ONLY
-- ============================================
-- 
-- ⚠️  THIS FILE MUST BE RUN MANUALLY IN:
--     Supabase Dashboard > SQL Editor
-- 
-- WHY?
-- - The auth.users table is owned by Supabase
-- - Only the Dashboard SQL Editor has permission to create triggers on it
-- - The anon key (used by client SDK) does NOT have this permission
-- - Lovable Cloud works because it has internal service_role access
--
-- STEPS:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this ENTIRE file
-- 4. Click "Run"
--
-- ============================================

-- First, ensure the function exists (safe to re-run)
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
  safe_tiktok_username text;
  new_profile_id uuid;
BEGIN
  -- Get animal avatars array
  animal_avatars := ARRAY['🦊', '🐼', '🦁', '🐯', '🐻', '🐨', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🐺', '🐗', '🐴', '🦄', '🐝', '🦋', '🐌', '🐢', '🐍', '🦎', '🦖', '🐙', '🦀', '🐠', '🐬', '🦈', '🐳'];
  
  -- Pick random avatar
  random_avatar := animal_avatars[1 + floor(random() * array_length(animal_avatars, 1))::int];
  
  -- Generate unique referral code
  new_referral_code := upper(substring(replace(NEW.id::text, '-', '') from 1 for 8));
  
  -- SAFETY: Ensure tiktok_username is never null
  safe_tiktok_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'tiktok_username'), ''),
    'user_' || left(replace(NEW.id::text, '-', ''), 10)
  );
  
  -- Get welcome bonus (default 0)
  SELECT COALESCE((value->>'welcome_bonus')::integer, 0)
  INTO welcome_bonus_amount
  FROM public.platform_settings
  WHERE key = 'bonus_settings';
  
  IF welcome_bonus_amount IS NULL THEN
    welcome_bonus_amount := 0;
  END IF;
  
  -- Get referral code from metadata
  referral_param := NEW.raw_user_meta_data->>'referral_code';
  
  -- Find referrer
  IF referral_param IS NOT NULL AND referral_param != '' THEN
    SELECT id INTO referrer_profile_id
    FROM public.profiles
    WHERE referral_code = upper(referral_param);
  END IF;
  
  -- Create profile (with conflict handling)
  INSERT INTO public.profiles (
    user_id, email, first_name, last_name, tiktok_username, tiktok_name, 
    avatar_url, country, referral_code, referred_by, tik_points
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'no-email@placeholder.local'),
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    safe_tiktok_username,
    NEW.raw_user_meta_data ->> 'tiktok_name',
    random_avatar,
    NEW.raw_user_meta_data ->> 'country',
    new_referral_code,
    referrer_profile_id,
    COALESCE(welcome_bonus_amount, 0)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    tiktok_username = COALESCE(NULLIF(EXCLUDED.tiktok_username, ''), public.profiles.tiktok_username),
    tiktok_name = COALESCE(EXCLUDED.tiktok_name, public.profiles.tiktok_name),
    country = COALESCE(EXCLUDED.country, public.profiles.country)
  RETURNING id INTO new_profile_id;

  -- Create referral if applicable
  IF referrer_profile_id IS NOT NULL AND new_profile_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id)
    VALUES (referrer_profile_id, new_profile_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Welcome bonus
  IF welcome_bonus_amount > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (NEW.id, welcome_bonus_amount, 'bonus', 'Welcome bonus');
    
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (NEW.id, 'points_earned', 'Welcome Bonus!',
            format('You received %s TikPoints as a welcome bonus!', welcome_bonus_amount));
  END IF;

  -- Assign role
  IF lower(NEW.email) = 'admin@tikswap.online' THEN
    initial_role := 'admin'::public.app_role;
  ELSE
    initial_role := 'user'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, initial_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user error: % %', SQLERRM, SQLSTATE;
    -- Minimal fallback
    INSERT INTO public.profiles (user_id, email, tiktok_username)
    VALUES (NEW.id, COALESCE(NEW.email, 'no-email@placeholder.local'),
            'user_' || left(replace(NEW.id::text, '-', ''), 10))
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add comment
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Automatically creates profile and role on user signup';

-- ============================================
-- SUCCESS! The trigger is now active.
-- New signups will automatically create profiles.
-- ============================================
