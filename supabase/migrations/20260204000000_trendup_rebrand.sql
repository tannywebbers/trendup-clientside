-- ============================================
-- TRENDUP REBRAND + CONTENT SEED
-- Changes app name, currency name, landing copy,
-- DB function messages, and bootstraps admin email.
-- ============================================

-- 1. Update app_settings
UPDATE public.app_settings
SET
  app_name = 'TrendUp',
  app_description = 'Exchange engagement with real users by engaging on others content and boosting your own profile.',
  meta_title = 'TrendUp - TikTok Engagement Exchange',
  meta_description = 'The leading platform for TikTok engagement exchange. Grow your profile with authentic engagement from real users.',
  points_name = 'Streak Points',
  points_short_name = 'SP',
  support_email = COALESCE(support_email, 'support@trendup.com'),
  platform_name = 'TikTok',
  updated_at = now()
WHERE app_name = 'TikPoints' OR app_name IS NULL;

-- Make sure there is always exactly one settings row
INSERT INTO public.app_settings (app_name, app_description, meta_title, points_name, points_short_name)
SELECT 'TrendUp', 'Exchange engagement with real users by engaging on others content and boosting your own profile.', 'TrendUp - TikTok Engagement Exchange', 'Streak Points', 'SP'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

-- 2. Update platform_settings (site_settings)
UPDATE public.platform_settings
SET value = value || '{"site_name": "TrendUp", "support_email": "support@trendup.com"}'::jsonb
WHERE key = 'site_settings';

-- Add live analytics toggle (admin can flip on)
INSERT INTO public.platform_settings (key, value)
VALUES ('live_stats_enabled', 'false'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = 'false'::jsonb, updated_at = now();

-- 3. Update landing_content with TrendUp copy
UPDATE public.landing_content SET
  title = 'Grow Your TikTok with Real Engagement',
  subtitle = 'Real Engagement, Real Growth',
  content = 'Exchange engagement with real users by engaging on others content and boosting your own profile.',
  button_text = 'Start Growing Now',
  button_url = '/register'
WHERE section_key = 'hero';

UPDATE public.landing_content SET
  title = 'Why Choose TrendUp?',
  subtitle = 'The easiest way to boost your TikTok engagement',
  content = 'AI-powered verification, instant rewards, secure payments.'
WHERE section_key = 'features';

UPDATE public.landing_content SET
  subtitle = 'Start growing on TikTok in minutes with our simple 4-step process'
WHERE section_key = 'how_it_works';

UPDATE public.landing_content SET
  title = 'Our Stats',
  subtitle = 'Real numbers from our growing community'
WHERE section_key = 'stats';

UPDATE public.landing_content SET
  title = 'Ready to Start Growing?',
  button_text = 'Join TrendUp Today',
  content = 'Sign up now and get 50 bonus Streak Points!'
WHERE section_key = 'cta';

-- 4. Recreate handle_new_user with Streak Points messaging + TrendUp admin bootstrap
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
  
  -- Get welcome bonus from platform settings (default to 0 if not found)
  SELECT COALESCE((value->>'welcome_bonus')::integer, 0)
  INTO welcome_bonus_amount
  FROM public.platform_settings
  WHERE key = 'bonus_settings';
  
  IF welcome_bonus_amount IS NULL THEN
    welcome_bonus_amount := 0;
  END IF;
  
  -- Get referral code from user metadata
  referral_param := NEW.raw_user_meta_data->>'referral_code';
  
  -- Find referrer if referral code provided
  IF referral_param IS NOT NULL AND referral_param != '' THEN
    SELECT id INTO referrer_profile_id
    FROM public.profiles
    WHERE referral_code = upper(referral_param);
  END IF;
  
  -- Create profile with all required fields populated
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
  RETURNING id INTO new_profile_id;

  -- If there's a referrer, create a referral record
  IF referrer_profile_id IS NOT NULL AND new_profile_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id)
    VALUES (referrer_profile_id, new_profile_id);
  END IF;

  -- Create welcome bonus transaction if bonus > 0
  IF welcome_bonus_amount > 0 THEN
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
      format('You received %s Streak Points as a welcome bonus!', welcome_bonus_amount)
    );
  END IF;

  -- Bootstrap admin by email
  IF lower(NEW.email) = 'admin@trendup.com' THEN
    initial_role := 'admin'::public.app_role;
  ELSE
    initial_role := 'user'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, initial_role);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user error: % %', SQLERRM, SQLSTATE;
    INSERT INTO public.profiles (user_id, email, tiktok_username)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, 'no-email@placeholder.local'),
      'user_' || left(replace(NEW.id::text, '-', ''), 10)
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- 5. Recreate credit_purchase_points with Streak Points messaging
CREATE OR REPLACE FUNCTION public.credit_purchase_points(_user_id uuid, _points integer, _amount_paid numeric, _reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

  INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
  VALUES (
    _user_id,
    _points,
    'purchase',
    format('Purchased %s Streak Points for ₦%s', _points, _amount_paid),
    _reference
  )
  ON CONFLICT (reference_id) DO NOTHING
  RETURNING id INTO inserted_tx_id;

  IF inserted_tx_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  UPDATE public.profiles
  SET tik_points = tik_points + _points
  WHERE user_id = _user_id
  RETURNING tik_points, id, referred_by INTO new_balance, user_profile_id, referrer_profile_id;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user_id %', _user_id;
  END IF;

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
          referrer_id, 
          referred_id, 
          transaction_id, 
          purchase_amount, 
          commission_percentage, 
          commission_points
        )
        VALUES (
          referrer_profile_id,
          user_profile_id,
          inserted_tx_id,
          _points,
          commission_pct,
          commission_pts
        );
        
        INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
        SELECT p.user_id, commission_pts, 'referral_commission', 
               format('Referral commission (%s%%) from referred user purchase', commission_pct),
               _reference || '_commission'
        FROM public.profiles p
        WHERE p.id = referrer_profile_id;
        
        INSERT INTO public.notifications (user_id, type, title, message)
        SELECT p.user_id, 'points_earned', 'Referral Commission!',
               format('You earned %s Streak Points from a referred user purchase!', commission_pts)
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
    format('You successfully purchased %s Streak Points.', _points),
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

-- 6. Also ensure the auth trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();