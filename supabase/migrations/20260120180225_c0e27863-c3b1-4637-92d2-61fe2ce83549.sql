-- Add is_banned and banned_at fields to profiles (if not exists)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS ban_reason text;

-- Create email_verifications table for OTP codes and verification links
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  user_id uuid,
  code text NOT NULL,
  verification_type text NOT NULL DEFAULT 'code' CHECK (verification_type IN ('code', 'link')),
  expires_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on email_verifications
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Policy for email verifications - users can only see their own
CREATE POLICY "Users can view own verifications" ON public.email_verifications
  FOR SELECT USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- Public insert for registration flow (before user is authenticated)
CREATE POLICY "Public insert for verification" ON public.email_verifications
  FOR INSERT WITH CHECK (true);

-- Create app_settings table for generalized app configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_name text DEFAULT 'TikPoints',
  app_description text DEFAULT 'Earn points by engaging with TikTok content',
  meta_title text DEFAULT 'TikPoints - TikTok Engagement Exchange',
  meta_description text DEFAULT 'The leading platform for TikTok engagement exchange. Earn and advertise smarter.',
  logo_url text,
  favicon_url text,
  primary_color text DEFAULT '#ec4899',
  accent_color text DEFAULT '#06b6d4',
  platform_name text DEFAULT 'TikTok',
  platform_username_label text DEFAULT 'TikTok Username',
  platform_display_name_label text DEFAULT 'TikTok Display Name',
  points_name text DEFAULT 'TikPoints',
  points_short_name text DEFAULT 'pts',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read app_settings
CREATE POLICY "Anyone can read app settings" ON public.app_settings
  FOR SELECT USING (true);

-- Only admins can update
CREATE POLICY "Admins can update app settings" ON public.app_settings
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Insert default app settings if not exists
INSERT INTO public.app_settings (app_name) 
SELECT 'TikPoints' WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

-- Create trigger to update app_settings updated_at
CREATE OR REPLACE FUNCTION public.update_app_settings_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_settings_timestamp();