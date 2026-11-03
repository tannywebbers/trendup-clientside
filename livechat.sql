-- Live Chat Migration

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS live_chat_welcome text;
UPDATE public.app_settings SET live_chat_welcome = COALESCE(live_chat_welcome, 'Hello {name}! ?? Welcome to support. How can we help you today?') WHERE id = 'cfcdf20e-c8c1-489d-9b3e-75d54e1ee851';
CREATE OR REPLACE FUNCTION public.get_public_branding()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS \$\$
  SELECT jsonb_build_object(
    'name', COALESCE(app_name, 'TrendUp'),
    'tagline', '',
    'logo_url', COALESCE(logo_url, ''),
    'logo_path', '',
    'support_email', COALESCE(support_email, ''),
    'live_chat_welcome', COALESCE(live_chat_welcome, 'Hello {name}! ?? Welcome to support. How can we help you today?')
  )
  FROM public.app_settings
  LIMIT 1;
\$\$;
GRANT EXECUTE ON FUNCTION public.get_public_branding() TO anon, authenticated;




