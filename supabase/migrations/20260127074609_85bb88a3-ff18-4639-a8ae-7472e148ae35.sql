
-- Fix 1: Add missing columns to profiles for referrals
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

-- Create index for referral code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- Fix 2: Create referrals tracking table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

-- Enable RLS on referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- RLS policies for referrals
CREATE POLICY "Users can view own referrals"
ON public.referrals FOR SELECT
USING (auth.uid() IN (
  SELECT user_id FROM public.profiles WHERE id = referrer_id
));

CREATE POLICY "System can insert referrals"
ON public.referrals FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can manage referrals"
ON public.referrals FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: Create referral commissions table to track earned commissions
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  purchase_amount INTEGER NOT NULL,
  commission_percentage NUMERIC(5,2) NOT NULL,
  commission_points INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(transaction_id)
);

-- Enable RLS on referral_commissions
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for referral_commissions
CREATE POLICY "Users can view own commissions"
ON public.referral_commissions FOR SELECT
USING (auth.uid() IN (
  SELECT user_id FROM public.profiles WHERE id = referrer_id
));

CREATE POLICY "System can insert commissions"
ON public.referral_commissions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can manage commissions"
ON public.referral_commissions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 4: Update handle_new_user function to include referral code and welcome bonus
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
  -- Get animal avatars array
  animal_avatars := ARRAY['🦊', '🐼', '🦁', '🐯', '🐻', '🐨', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🐺', '🐗', '🐴', '🦄', '🐝', '🦋', '🐌', '🐢', '🐍', '🦎', '🦖', '🐙', '🦀', '🐠', '🐬', '🦈', '🐳'];
  
  -- Pick random avatar
  random_avatar := animal_avatars[1 + floor(random() * array_length(animal_avatars, 1))::int];
  
  -- Generate unique referral code
  new_referral_code := upper(substring(replace(NEW.id::text, '-', '') from 1 for 8));
  
  -- Get welcome bonus from platform settings
  SELECT COALESCE((value->>'welcome_bonus')::integer, 0)
  INTO welcome_bonus_amount
  FROM public.platform_settings
  WHERE key = 'bonus_settings';
  
  -- Get referral code from user metadata
  referral_param := NEW.raw_user_meta_data->>'referral_code';
  
  -- Find referrer if referral code provided
  IF referral_param IS NOT NULL AND referral_param != '' THEN
    SELECT id INTO referrer_profile_id
    FROM public.profiles
    WHERE referral_code = upper(referral_param);
  END IF;
  
  -- Create profile with referral code and welcome bonus
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
    NEW.email,
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

  -- If there's a referrer, create a referral record
  IF referrer_profile_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id)
    SELECT referrer_profile_id, p.id
    FROM public.profiles p
    WHERE p.user_id = NEW.id;
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
    
    -- Create notification for welcome bonus
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.id,
      'points_earned',
      'Welcome Bonus!',
      format('You received %s TikPoints as a welcome bonus!', welcome_bonus_amount)
    );
  END IF;

  -- Bootstrap admin by email
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

-- Fix 5: Recreate the trigger (drop if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix 6: Update credit_purchase_points to include referral commission
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
    -- Get commission percentage from settings
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
        
        -- Record the commission
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
        
        -- Create commission transaction for referrer
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

-- Fix 7: Create profile for existing user that's missing
INSERT INTO public.profiles (user_id, email, first_name, last_name, tiktok_username, tiktok_name, avatar_url, country, referral_code, tik_points)
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'first_name',
  u.raw_user_meta_data->>'last_name',
  COALESCE(NULLIF(u.raw_user_meta_data->>'tiktok_username', ''), 'user_' || left(replace(u.id::text, '-', ''), 10)),
  u.raw_user_meta_data->>'tiktok_name',
  '🦊',
  u.raw_user_meta_data->>'country',
  upper(substring(replace(u.id::text, '-', '') from 1 for 8)),
  0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- Fix 8: Create user_roles for any users missing roles
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT DO NOTHING;
