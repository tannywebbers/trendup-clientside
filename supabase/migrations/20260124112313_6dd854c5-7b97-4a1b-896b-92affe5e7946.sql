-- Table to track login attempts for lockout functionality
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  email text NOT NULL,
  attempt_type text NOT NULL DEFAULT 'password', -- 'password', 'totp', 'backup_code'
  is_successful boolean NOT NULL DEFAULT false,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX idx_admin_login_attempts_email_time ON public.admin_login_attempts(email, created_at);
CREATE INDEX idx_admin_login_attempts_user_time ON public.admin_login_attempts(user_id, created_at);

-- Enable RLS
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can view attempts (for audit)
CREATE POLICY "Admins can view login attempts"
ON public.admin_login_attempts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert attempts (service role only, no client insert)
CREATE POLICY "System can manage login attempts"
ON public.admin_login_attempts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Table for moderator activity logging
CREATE TABLE IF NOT EXISTS public.moderator_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  moderator_id uuid NOT NULL,
  action text NOT NULL,
  target_type text, -- 'user', 'submission', 'chat', etc.
  target_id text,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX idx_moderator_activity_moderator ON public.moderator_activity_logs(moderator_id, created_at);

-- Enable RLS
ALTER TABLE public.moderator_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity
CREATE POLICY "Admins can view all activity"
ON public.moderator_activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Moderators can view own activity
CREATE POLICY "Moderators can view own activity"
ON public.moderator_activity_logs
FOR SELECT
USING (auth.uid() = moderator_id);

-- System can insert activity
CREATE POLICY "System can insert activity"
ON public.moderator_activity_logs
FOR INSERT
WITH CHECK (true);

-- Add locked_until column to admin_totp_secrets
ALTER TABLE public.admin_totp_secrets 
ADD COLUMN IF NOT EXISTS locked_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;