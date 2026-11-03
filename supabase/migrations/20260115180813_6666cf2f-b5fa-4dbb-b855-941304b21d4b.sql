-- Add points_per_currency setting to platform_settings if not exists
-- This allows admin to set exchange rate like 10 points = 5 naira

-- Also ensure the allowed_email_domains checks work properly by adding an index
CREATE INDEX IF NOT EXISTS idx_allowed_email_domains_domain ON public.allowed_email_domains(domain);
CREATE INDEX IF NOT EXISTS idx_allowed_email_domains_enabled ON public.allowed_email_domains(is_enabled);

-- Add unique constraint on domain to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allowed_email_domains_domain_unique'
  ) THEN
    ALTER TABLE public.allowed_email_domains ADD CONSTRAINT allowed_email_domains_domain_unique UNIQUE (domain);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;