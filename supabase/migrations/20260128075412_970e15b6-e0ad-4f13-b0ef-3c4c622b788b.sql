-- Add pwa_icon_url column to app_settings for PWA app icon
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS pwa_icon_url text DEFAULT NULL;

-- Create storage bucket for app assets (logos, icons)
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view app assets (public bucket)
CREATE POLICY "Anyone can view app assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-assets');

-- Only admins can upload app assets
CREATE POLICY "Admins can upload app assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can update app assets
CREATE POLICY "Admins can update app assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can delete app assets
CREATE POLICY "Admins can delete app assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));