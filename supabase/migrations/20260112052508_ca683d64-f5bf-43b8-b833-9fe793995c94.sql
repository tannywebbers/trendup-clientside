-- Add display_name_changed_at to profiles for 7-day cooldown
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create ad_settings table for Adsterra ad configuration
CREATE TABLE IF NOT EXISTS public.ad_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_type TEXT NOT NULL UNIQUE, -- 'banner', 'popup', 'popunder', 'social', 'native', 'interstitial'
  is_enabled BOOLEAN DEFAULT FALSE,
  ad_code TEXT DEFAULT '',
  placement TEXT DEFAULT '', -- 'header', 'footer', 'sidebar', 'in-content'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on ad_settings
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage ad settings
CREATE POLICY "Admins can manage ad settings"
ON public.ad_settings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Allow all authenticated users to read ad settings (for rendering ads)
CREATE POLICY "Anyone can read ad settings"
ON public.ad_settings
FOR SELECT
USING (true);

-- Create trigger for updated_at on ad_settings
CREATE TRIGGER update_ad_settings_updated_at
BEFORE UPDATE ON public.ad_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default ad types
INSERT INTO public.ad_settings (ad_type, is_enabled, ad_code, placement)
VALUES 
  ('banner_top', false, '', 'header'),
  ('banner_bottom', false, '', 'footer'),
  ('banner_sidebar', false, '', 'sidebar'),
  ('native_feed', false, '', 'in-content'),
  ('popup', false, '', 'overlay'),
  ('popunder', false, '', 'overlay'),
  ('social_bar', false, '', 'footer'),
  ('interstitial', false, '', 'fullscreen')
ON CONFLICT (ad_type) DO NOTHING;