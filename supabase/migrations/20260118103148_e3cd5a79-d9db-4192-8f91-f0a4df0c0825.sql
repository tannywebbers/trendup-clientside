-- Add smtp_password column to store the password securely
ALTER TABLE public.smtp_config 
ADD COLUMN IF NOT EXISTS smtp_password TEXT;

-- Add comment for security awareness
COMMENT ON COLUMN public.smtp_config.smtp_password IS 'Encrypted SMTP password - should only be accessed by edge functions';