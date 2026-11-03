-- ============================================
-- FUNCTIONS.SQL - All Database Functions
-- ============================================
-- Run AFTER tables.sql, BEFORE triggers.sql
-- Safe to re-run: uses CREATE OR REPLACE
-- ============================================

-- ============================================
-- FUNCTION: has_role
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

GRANT EXECUTE ON FUNCTION public.has_role TO anon, authenticated;

-- ============================================
-- FUNCTION: update_updated_at_column
-- Generic timestamp trigger used by most tables
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_updated_at_column TO anon, authenticated, service_role;

-- ============================================
-- FUNCTION: update_app_settings_timestamp
-- ============================================

CREATE OR REPLACE FUNCTION public.update_app_settings_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_app_settings_timestamp TO anon, authenticated, service_role;

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

GRANT EXECUTE ON FUNCTION public.update_landing_content_timestamp TO anon, authenticated, service_role;

-- ============================================
-- FUNCTION: handle_new_user
-- CRITICAL: Fires on auth.users INSERT via trigger.
-- This is the ONLY definition. Do NOT redefine elsewhere.
-- SECURITY DEFINER = bypasses RLS automatically.
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
  -- Animal avatars for random avatar assignment
  animal_avatars := ARRAY['🦊', '🐼', '🦁', '🐯', '🐻', '🐨', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🐺', '🐗', '🐴', '🦄', '🐝', '🦋', '🐌', '🐢', '🐍', '🦎', '🦖', '🐙', '🦀', '🐠', '🐬', '🦈', '🐳'];
  random_avatar := animal_avatars[1 + floor(random() * array_length(animal_avatars, 1))::int];

  -- Generate referral code from user UUID
  new_referral_code := upper(substring(replace(NEW.id::text, '-', '') from 1 for 8));

  -- Safe tiktok_username: never null (NOT NULL constraint on table)
  safe_tiktok_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'tiktok_username'), ''),
    'user_' || left(replace(NEW.id::text, '-', ''), 10)
  );

  -- Fetch welcome bonus from platform_settings (safe, defaults to 0)
  BEGIN
    SELECT COALESCE((value->>'welcome_bonus')::integer, 0)
    INTO welcome_bonus_amount
    FROM public.platform_settings
    WHERE key = 'bonus_settings';
  EXCEPTION WHEN OTHERS THEN
    welcome_bonus_amount := 0;
  END;

  IF welcome_bonus_amount IS NULL THEN
    welcome_bonus_amount := 0;
  END IF;

  -- Resolve referral code from signup metadata
  referral_param := NEW.raw_user_meta_data->>'referral_code';

  IF referral_param IS NOT NULL AND referral_param != '' THEN
    BEGIN
      SELECT id INTO referrer_profile_id
      FROM public.profiles
      WHERE referral_code = upper(referral_param);
    EXCEPTION WHEN OTHERS THEN
      referrer_profile_id := NULL;
    END;
  END IF;

  -- INSERT profile (idempotent via ON CONFLICT)
  INSERT INTO public.profiles (
    user_id, email, first_name, last_name,
    tiktok_username, tiktok_name, avatar_url,
    country, referral_code, referred_by, tik_points
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
    tik_points = GREATEST(public.profiles.tik_points, COALESCE(EXCLUDED.tik_points, 0));

  -- Fetch the new profile id
  SELECT id INTO new_profile_id
  FROM public.profiles
  WHERE user_id = NEW.id;

  -- Create referral record if a valid referrer was found
  IF referrer_profile_id IS NOT NULL AND new_profile_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.referrals (referrer_id, referred_id)
      VALUES (referrer_profile_id, new_profile_id);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Silently ignore duplicate or bad referral
    END;
  END IF;

  -- Welcome bonus transaction + notification
  IF welcome_bonus_amount > 0 THEN
    BEGIN
      INSERT INTO public.transactions (user_id, amount, type, description)
      VALUES (NEW.id, welcome_bonus_amount, 'bonus', 'Welcome bonus');

      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        NEW.id, 'points_earned', 'Welcome Bonus!',
        format('You received %s TikPoints as a welcome bonus!', welcome_bonus_amount)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Don't break signup over bonus failure
    END;
  END IF;

  -- Role assignment: admin for the owner email, user for everyone else
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
    -- CRITICAL SAFETY NET: Never let this function crash auth.
    -- If everything above failed, at minimum create a bare profile + role.
    RAISE WARNING 'handle_new_user error: % %', SQLERRM, SQLSTATE;

    BEGIN
      INSERT INTO public.profiles (user_id, email, tiktok_username)
      VALUES (
        NEW.id,
        COALESCE(NEW.email, 'no-email@placeholder.local'),
        'user_' || left(replace(NEW.id::text, '-', ''), 10)
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'user'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    RETURN NEW;
END;
$$;

-- ============================================
-- FUNCTION: ensure_profile_on_login
-- Repair path: creates profile if trigger never fired.
-- Only allows the authenticated user to bootstrap themselves.
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
  -- Auth check: only the logged-in user can bootstrap their own profile
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

  -- Baseline role only — never escalate from client
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN created_profile_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'ensure_profile_on_login error: % %', SQLERRM, SQLSTATE;
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile_on_login TO authenticated;

-- ============================================
-- FUNCTION: credit_purchase_points
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
  IF _user_id IS NULL OR _reference IS NULL OR length(trim(_reference)) = 0 THEN
    RAISE EXCEPTION 'Missing user_id or reference';
  END IF;

  IF _points IS NULL OR _points <= 0 THEN
    RAISE EXCEPTION 'Invalid points';
  END IF;

  -- Idempotent insert: duplicate reference = already processed
  INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
  VALUES (
    _user_id, _points, 'purchase',
    format('Purchased %s TikPoints for ₦%s', _points, _amount_paid),
    _reference
  )
  ON CONFLICT (reference_id) DO NOTHING
  RETURNING id INTO inserted_tx_id;

  IF inserted_tx_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  -- Credit points and grab referral info in one shot
  UPDATE public.profiles
  SET tik_points = tik_points + _points
  WHERE user_id = _user_id
  RETURNING tik_points, id, referred_by INTO new_balance, user_profile_id, referrer_profile_id;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user_id %', _user_id;
  END IF;

  -- Referral commission logic
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
          referrer_id, referred_id, transaction_id,
          purchase_amount, commission_percentage, commission_points
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

  -- Notify the purchaser
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    _user_id, 'points_earned', 'Points Purchased!',
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

-- ============================================
-- DONE - All functions created successfully
-- ============================================
