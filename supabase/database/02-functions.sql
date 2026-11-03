-- ============================================
-- FUNCTIONS.SQL - All Database Functions
-- ============================================
-- Run AFTER tables.sql
-- Safe to re-run: uses CREATE OR REPLACE
-- ============================================

-- ============================================
-- FUNCTION: has_role
-- Description: Check if user has a specific role
-- Used by RLS policies
-- ============================================

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

COMMENT ON FUNCTION public.has_role IS 'Check if user has specific role. Used in RLS policies.';

-- ============================================
-- FUNCTION: handle_new_user
-- Description: Creates profile and role on signup
-- CRITICAL: This runs on auth.users INSERT
-- MUST NEVER FAIL or signup breaks
-- ============================================

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
  
  -- Generate unique referral code from user ID
  new_referral_code := upper(substring(replace(NEW.id::text, '-', '') from 1 for 8));
  
  -- SAFETY: Ensure tiktok_username is never null
  -- This is critical - table has NOT NULL constraint
  safe_tiktok_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'tiktok_username'), ''),
    'user_' || left(replace(NEW.id::text, '-', ''), 10)
  );
  
  -- Get welcome bonus from platform settings (default to 0 if not found)
  BEGIN
    SELECT COALESCE((value->>'welcome_bonus')::integer, 0)
    INTO welcome_bonus_amount
    FROM public.platform_settings
    WHERE key = 'bonus_settings';
  EXCEPTION WHEN OTHERS THEN
    welcome_bonus_amount := 0;
  END;
  
  -- If no settings found, default to 0
  IF welcome_bonus_amount IS NULL THEN
    welcome_bonus_amount := 0;
  END IF;
  
  -- Get referral code from user metadata
  referral_param := NEW.raw_user_meta_data->>'referral_code';
  
  -- Find referrer if referral code provided
  IF referral_param IS NOT NULL AND referral_param != '' THEN
    BEGIN
      SELECT id INTO referrer_profile_id
      FROM public.profiles
      WHERE referral_code = upper(referral_param);
    EXCEPTION WHEN OTHERS THEN
      referrer_profile_id := NULL;
    END;
  END IF;
  
  -- Create/repair profile (idempotent)
  INSERT INTO public.profiles (
    user_id,
    email,
    first_name,
    last_name,
    tiktok_username,
    tiktok_name,
    avatar_url,
    country,
    referral_code,
    referred_by,
    tik_points
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
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    tiktok_username = COALESCE(EXCLUDED.tiktok_username, public.profiles.tiktok_username),
    tiktok_name = COALESCE(EXCLUDED.tiktok_name, public.profiles.tiktok_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    country = COALESCE(EXCLUDED.country, public.profiles.country),
    referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code),
    referred_by = COALESCE(public.profiles.referred_by, EXCLUDED.referred_by),
    -- never decrease points here
    tik_points = GREATEST(public.profiles.tik_points, COALESCE(EXCLUDED.tik_points, 0));

  SELECT id INTO new_profile_id
  FROM public.profiles
  WHERE user_id = NEW.id;

  -- Create referral record if referrer exists
  IF referrer_profile_id IS NOT NULL AND new_profile_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.referrals (referrer_id, referred_id)
      VALUES (referrer_profile_id, new_profile_id);
    EXCEPTION WHEN OTHERS THEN
      -- Ignore referral errors
      NULL;
    END;
  END IF;

  -- Create welcome bonus transaction if bonus > 0
  IF welcome_bonus_amount > 0 THEN
    BEGIN
      INSERT INTO public.transactions (user_id, amount, type, description)
      VALUES (
        NEW.id,
        welcome_bonus_amount,
        'bonus',
        'Welcome bonus'
      );
      
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        NEW.id,
        'points_earned',
        'Welcome Bonus!',
        format('You received %s TikPoints as a welcome bonus!', welcome_bonus_amount)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Ignore bonus errors
      NULL;
    END;
  END IF;

  -- Assign role (admin for specific email, user for everyone else)
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
    -- CRITICAL: Never let this function fail completely
    -- If main logic fails, still create minimal profile and role
    RAISE WARNING 'handle_new_user error: % %', SQLERRM, SQLSTATE;
    
    -- Create minimal profile
    BEGIN
      INSERT INTO public.profiles (user_id, email, tiktok_username)
      VALUES (
        NEW.id,
        COALESCE(NEW.email, 'no-email@placeholder.local'),
        'user_' || left(replace(NEW.id::text, '-', ''), 10)
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    -- Create user role
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'user'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS 'Creates profile and role on signup. Has comprehensive exception handling to NEVER break auth.';

-- ============================================
-- FUNCTION: ensure_profile_on_login
-- Description: Repair path when trigger didn't run
--
-- IMPORTANT SECURITY NOTES:
-- - Does NOT allow setting roles (always assigns 'user' only)
-- - Verifies caller owns _user_id (auth.uid())
-- - Safe to call from the app after login
-- ============================================

CREATE OR REPLACE FUNCTION public.ensure_profile_on_login(
  _user_id uuid,
  _email text,
  _raw_user_meta_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_profile_id uuid;
  safe_tiktok_username text;
BEGIN
  -- Prevent privilege escalation: user can only bootstrap themselves
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  safe_tiktok_username := COALESCE(
    NULLIF(TRIM(_raw_user_meta_data ->> 'tiktok_username'), ''),
    'user_' || left(replace(_user_id::text, '-', ''), 10)
  );

  INSERT INTO public.profiles (user_id, email, tiktok_username, first_name, last_name, tiktok_name, country)
  VALUES (
    _user_id,
    COALESCE(_email, 'no-email@placeholder.local'),
    safe_tiktok_username,
    NULLIF(TRIM(_raw_user_meta_data ->> 'first_name'), ''),
    NULLIF(TRIM(_raw_user_meta_data ->> 'last_name'), ''),
    NULLIF(TRIM(_raw_user_meta_data ->> 'tiktok_name'), ''),
    NULLIF(TRIM(_raw_user_meta_data ->> 'country'), '')
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = COALESCE(public.profiles.email, EXCLUDED.email),
    tiktok_username = COALESCE(public.profiles.tiktok_username, EXCLUDED.tiktok_username),
    first_name = COALESCE(public.profiles.first_name, EXCLUDED.first_name),
    last_name = COALESCE(public.profiles.last_name, EXCLUDED.last_name),
    tiktok_name = COALESCE(public.profiles.tiktok_name, EXCLUDED.tiktok_name),
    country = COALESCE(public.profiles.country, EXCLUDED.country)
  RETURNING id INTO created_profile_id;

  -- Never allow role assignment from the client; only ensure baseline role exists.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN created_profile_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block login flows if the caller chooses to ignore errors.
    RAISE WARNING 'ensure_profile_on_login error: % %', SQLERRM, SQLSTATE;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.ensure_profile_on_login IS 'Creates missing profile for the current logged-in user; assigns baseline user role only. Safe repair path if auth trigger failed.';

-- ============================================
-- FUNCTION: credit_purchase_points
-- Description: Credit points from payment
-- ============================================

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
  -- Validate inputs
  IF _user_id IS NULL OR _reference IS NULL OR length(trim(_reference)) = 0 THEN
    RAISE EXCEPTION 'Missing user_id or reference';
  END IF;

  IF _points IS NULL OR _points <= 0 THEN
    RAISE EXCEPTION 'Invalid points';
  END IF;

  -- Insert transaction (if duplicate reference, return already processed)
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

  -- Update user balance
  UPDATE public.profiles
  SET tik_points = tik_points + _points
  WHERE user_id = _user_id
  RETURNING tik_points, id, referred_by INTO new_balance, user_profile_id, referrer_profile_id;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user_id %', _user_id;
  END IF;

  -- Handle referral commission
  IF referrer_profile_id IS NOT NULL THEN
    SELECT COALESCE((value->>'referral_commission_percentage')::numeric, 0)
    INTO commission_pct
    FROM public.platform_settings
    WHERE key = 'bonus_settings';
    
    IF commission_pct > 0 THEN
      commission_pts := floor(_points * (commission_pct / 100));
      
      IF commission_pts > 0 THEN
        -- Credit referrer
        UPDATE public.profiles
        SET tik_points = tik_points + commission_pts
        WHERE id = referrer_profile_id;
        
        -- Record commission
        INSERT INTO public.referral_commissions (
          referrer_id, referred_id, transaction_id,
          purchase_amount, commission_percentage, commission_points
        )
        VALUES (
          referrer_profile_id, user_profile_id, inserted_tx_id,
          _points, commission_pct, commission_pts
        );
        
        -- Create commission transaction
        INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
        SELECT p.user_id, commission_pts, 'referral_commission',
               format('Referral commission (%s%%) from referred user purchase', commission_pct),
               _reference || '_commission'
        FROM public.profiles p
        WHERE p.id = referrer_profile_id;
        
        -- Notify referrer
        INSERT INTO public.notifications (user_id, type, title, message)
        SELECT p.user_id, 'points_earned', 'Referral Commission!',
               format('You earned %s TikPoints from a referred user purchase!', commission_pts)
        FROM public.profiles p
        WHERE p.id = referrer_profile_id;
      END IF;
    END IF;
  END IF;

  -- Notification for purchaser
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    _user_id,
    'points_earned',
    'Points Purchased!',
    format('You successfully purchased %s TikPoints.', _points)
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'transaction_id', inserted_tx_id,
    'new_balance', new_balance
  );
END;
$$;

COMMENT ON FUNCTION public.credit_purchase_points IS 'Credit points from payment with referral commission handling';

-- ============================================
-- FUNCTION: update_updated_at_column
-- Description: Auto-update updated_at timestamp
-- ============================================

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

COMMENT ON FUNCTION public.update_updated_at_column IS 'Auto-updates updated_at on row modification';

-- ============================================
-- FUNCTION: update_app_settings_timestamp
-- ============================================

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

-- ============================================
-- FUNCTION: update_landing_content_timestamp
-- ============================================

CREATE OR REPLACE FUNCTION public.update_landing_content_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- DONE - Functions created successfully
-- ============================================
