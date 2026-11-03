-- Add video_description column to ads table for comment generation
ALTER TABLE public.ads
ADD COLUMN IF NOT EXISTS video_description text,
ADD COLUMN IF NOT EXISTS comment_keywords text[];

-- Create landing_content table for CMS
CREATE TABLE IF NOT EXISTS public.landing_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key text NOT NULL UNIQUE,
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

-- Enable RLS
ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;

-- Public can read landing content
CREATE POLICY "Anyone can view landing content"
ON public.landing_content
FOR SELECT
USING (is_visible = true);

-- Admins can manage landing content
CREATE POLICY "Admins can manage landing content"
ON public.landing_content
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create SMTP config table
CREATE TABLE IF NOT EXISTS public.smtp_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 587,
  username text NOT NULL,
  password_set boolean NOT NULL DEFAULT false,
  from_name text NOT NULL DEFAULT 'TikPoints',
  from_email text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage SMTP config
CREATE POLICY "Admins can manage SMTP config"
ON public.smtp_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create allowed email domains table
CREATE TABLE IF NOT EXISTS public.allowed_email_domains (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.allowed_email_domains ENABLE ROW LEVEL SECURITY;

-- Anyone can read allowed domains (for validation)
CREATE POLICY "Anyone can read allowed domains"
ON public.allowed_email_domains
FOR SELECT
USING (true);

-- Admins can manage domains
CREATE POLICY "Admins can manage domains"
ON public.allowed_email_domains
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default allowed email domains
INSERT INTO public.allowed_email_domains (domain) VALUES
  ('gmail.com'),
  ('yahoo.com'),
  ('hotmail.com'),
  ('outlook.com'),
  ('icloud.com'),
  ('live.com'),
  ('aol.com'),
  ('protonmail.com'),
  ('mail.com'),
  ('yandex.com')
ON CONFLICT (domain) DO NOTHING;

-- Create follow_verifications table for delayed verification
CREATE TABLE IF NOT EXISTS public.follow_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL,
  ad_id uuid NOT NULL REFERENCES public.ads(id),
  user_id uuid NOT NULL,
  advertiser_tiktok_username text NOT NULL,
  performer_tiktok_username text NOT NULL,
  initial_check_passed boolean NOT NULL DEFAULT false,
  delay_check_passed boolean,
  initial_check_at timestamp with time zone,
  delay_check_at timestamp with time zone,
  scheduled_delay_check timestamp with time zone,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.follow_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own follow verifications
CREATE POLICY "Users can view own follow verifications"
ON public.follow_verifications
FOR SELECT
USING (auth.uid() = user_id);

-- System can manage follow verifications
CREATE POLICY "System can manage follow verifications"
ON public.follow_verifications
FOR ALL
USING (true);

-- Create generated_comments table to track unique comments per user/ad
CREATE TABLE IF NOT EXISTS public.generated_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id uuid NOT NULL REFERENCES public.ads(id),
  user_id uuid NOT NULL,
  comment_text text NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(ad_id, user_id)
);

-- Enable RLS
ALTER TABLE public.generated_comments ENABLE ROW LEVEL SECURITY;

-- Users can view their own generated comments
CREATE POLICY "Users can view own comments"
ON public.generated_comments
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert comments
CREATE POLICY "System can insert comments"
ON public.generated_comments
FOR INSERT
WITH CHECK (true);

-- Insert default landing content
INSERT INTO public.landing_content (section_key, title, subtitle, content, sort_order) VALUES
  ('hero', 'Earn Real Rewards for Your TikTok Engagement', 'Join thousands of users earning TikPoints by completing simple tasks', NULL, 1),
  ('features', 'Why Choose TikPoints?', 'The most trusted platform for TikTok engagement rewards', NULL, 2),
  ('how_it_works', 'How It Works', 'Start earning in 3 simple steps', NULL, 3),
  ('stats', 'Platform Statistics', 'Join our growing community', NULL, 4),
  ('cta', 'Ready to Start Earning?', 'Create your free account today and start completing tasks', NULL, 5)
ON CONFLICT (section_key) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_landing_content_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_landing_content_timestamp ON public.landing_content;
CREATE TRIGGER update_landing_content_timestamp
BEFORE UPDATE ON public.landing_content
FOR EACH ROW
EXECUTE FUNCTION update_landing_content_timestamp();