-- ============================================
-- FUNCTION: has_role
-- Description: Check if user has a specific role
-- Used in RLS policies to avoid recursion
-- ============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

COMMENT ON FUNCTION public.has_role IS 'Security definer function to check user roles without RLS recursion';
