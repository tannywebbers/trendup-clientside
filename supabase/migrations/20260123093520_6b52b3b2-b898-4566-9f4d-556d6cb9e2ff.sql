
-- Add moderator_permissions table for granular access control
CREATE TABLE IF NOT EXISTS public.moderator_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pages text[] NOT NULL DEFAULT '{}',
  can_manage_chat boolean NOT NULL DEFAULT true,
  can_review_submissions boolean NOT NULL DEFAULT false,
  can_manage_users boolean NOT NULL DEFAULT false,
  is_suspended boolean NOT NULL DEFAULT false,
  suspended_at timestamp with time zone,
  suspend_reason text,
  invited_at timestamp with time zone NOT NULL DEFAULT now(),
  invited_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.moderator_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage moderator permissions
CREATE POLICY "Admins can manage moderator permissions"
ON public.moderator_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Moderators can view their own permissions
CREATE POLICY "Moderators can view own permissions"
ON public.moderator_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Add TOTP secrets table for 2FA
CREATE TABLE IF NOT EXISTS public.admin_totp_secrets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_encrypted text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  backup_codes text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on TOTP secrets
ALTER TABLE public.admin_totp_secrets ENABLE ROW LEVEL SECURITY;

-- Only the user themselves can view their TOTP secret (for setup)
CREATE POLICY "Users can view own TOTP secret"
ON public.admin_totp_secrets
FOR SELECT
USING (auth.uid() = user_id);

-- System can manage TOTP secrets via service role
CREATE POLICY "System can manage TOTP secrets"
ON public.admin_totp_secrets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at triggers
CREATE TRIGGER update_moderator_permissions_updated_at
BEFORE UPDATE ON public.moderator_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_totp_secrets_updated_at
BEFORE UPDATE ON public.admin_totp_secrets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
