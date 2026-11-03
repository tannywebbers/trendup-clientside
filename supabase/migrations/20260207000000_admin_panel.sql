-- Admin panel: sliding banners + leaderboard rewards mode setting

-- ============================================================
-- 1. Sliding banners (raid banners shown on user dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sliding_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL CHECK (length(trim(message)) > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sliding_banners_message_nonempty CHECK (length(trim(message)) > 0)
);
ALTER TABLE public.sliding_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY sliding_banners_select_users ON public.sliding_banners FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY sliding_banners_select_staff ON public.sliding_banners FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
CREATE POLICY sliding_banners_staff_all ON public.sliding_banners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));

GRANT SELECT ON public.sliding_banners TO authenticated;
GRANT ALL ON public.sliding_banners TO service_role;

CREATE INDEX IF NOT EXISTS sliding_banners_active_idx ON public.sliding_banners (is_active, created_at DESC);

-- ============================================================
-- 2. Leaderboard rewards mode (auto vs manual)
-- ============================================================
INSERT INTO public.platform_settings (key, value) VALUES
  ('leaderboard_rewards_mode', '{"mode":"auto"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 3. Staff read access for new activity tables
-- ============================================================
DROP POLICY IF EXISTS daily_checkins_select_staff ON public.daily_checkins;
CREATE POLICY daily_checkins_select_staff ON public.daily_checkins
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));