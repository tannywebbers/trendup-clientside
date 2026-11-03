-- ============================================
-- TABLES: app_settings, platform_settings
-- Description: Application configuration
-- ============================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name text DEFAULT 'TikPoints',
  app_description text DEFAULT 'Earn points by engaging with TikTok content',
  meta_title text DEFAULT 'TikPoints - TikTok Engagement Exchange',
  meta_description text DEFAULT 'The leading platform for TikTok engagement exchange.',
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.app_settings IS 'Application branding and display settings';
COMMENT ON TABLE public.platform_settings IS 'Key-value platform configuration';
