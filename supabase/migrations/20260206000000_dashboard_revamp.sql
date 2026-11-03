-- Dashboard revamp: daily check-in, raids, leaderboard, post boosts, notification prefs
BEGIN;

-- ============================================================
-- 1. Extend notifications type CHECK to allow new categories
-- ============================================================
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.notifications'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('task_approved','task_rejected','task_completed','points_earned','points_spent',
           'admin_credit','admin_debit','announcement','feature_update','warning','info',
           'checkin','checkin_milestone','raid','raid_reminder','leaderboard','referral','wallet','promotion')
);

-- ============================================================
-- 2. Daily check-in
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  streak_length integer NOT NULL DEFAULT 1,
  reward_amount integer NOT NULL DEFAULT 0,
  reward_credited boolean NOT NULL DEFAULT false,
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_checkins_select_own ON public.daily_checkins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY daily_checkins_insert_own ON public.daily_checkins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
CREATE INDEX IF NOT EXISTS daily_checkins_user_date_idx ON public.daily_checkins (user_id, checkin_date DESC);

CREATE TABLE IF NOT EXISTS public.checkin_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  streak_length integer NOT NULL UNIQUE,
  reward_amount integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkin_milestones_length_positive CHECK (streak_length > 0),
  CONSTRAINT checkin_milestones_reward_positive CHECK (reward_amount > 0)
);
ALTER TABLE public.checkin_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkin_milestones_read ON public.checkin_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY checkin_milestones_staff_all ON public.checkin_milestones FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
GRANT SELECT ON public.checkin_milestones TO authenticated;
GRANT ALL ON public.checkin_milestones TO service_role;

CREATE TABLE IF NOT EXISTS public.checkin_milestone_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_id uuid REFERENCES public.daily_checkins(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  milestone_id uuid REFERENCES public.checkin_milestones(id) ON DELETE CASCADE,
  cycle_start_date date NOT NULL,
  streak_length integer NOT NULL,
  reward_amount integer NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checkin_milestone_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkin_ma_select_own ON public.checkin_milestone_awards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY checkin_ma_select_staff ON public.checkin_milestone_awards FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
GRANT SELECT ON public.checkin_milestone_awards TO authenticated;
GRANT ALL ON public.checkin_milestone_awards TO service_role;
CREATE INDEX IF NOT EXISTS checkin_ma_user_idx ON public.checkin_milestone_awards (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkin_ma_checkin_idx ON public.checkin_milestone_awards (checkin_id);

INSERT INTO public.checkin_milestones (streak_length, reward_amount) VALUES
  (3, 15), (7, 50), (14, 150), (30, 500)
ON CONFLICT (streak_length) DO NOTHING;

INSERT INTO public.platform_settings (key, value) VALUES
  ('checkin_settings', '{"enabled":true,"daily_reward":10,"timezone":"UTC","milestone_enabled":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 3. Raids
-- ============================================================
CREATE TABLE IF NOT EXISTS public.raid_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_url text NOT NULL,
  post_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','viewed','added')),
  viewed_by uuid REFERENCES auth.users(id),
  viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_date)
);
ALTER TABLE public.raid_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY raid_posts_select_own ON public.raid_posts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY raid_posts_select_staff ON public.raid_posts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
CREATE POLICY raid_posts_insert_own ON public.raid_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT ON public.raid_posts TO authenticated;
GRANT ALL ON public.raid_posts TO service_role;
CREATE INDEX IF NOT EXISTS raid_posts_date_idx ON public.raid_posts (post_date DESC);

CREATE TABLE IF NOT EXISTS public.raid_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_link text,
  post_window_start timestamptz,
  post_window_end timestamptz,
  raid_start timestamptz,
  raid_end timestamptz,
  reminder_every_minutes integer NOT NULL DEFAULT 10,
  reminder_buffer_minutes integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raid_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY raid_sessions_select_all ON public.raid_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY raid_sessions_staff_all ON public.raid_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
GRANT SELECT ON public.raid_sessions TO authenticated;
GRANT ALL ON public.raid_sessions TO service_role;
CREATE INDEX IF NOT EXISTS raid_sessions_active_idx ON public.raid_sessions (is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS public.raid_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.raid_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'joined' CHECK (status IN ('joined','verified','completed')),
  points_awarded integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (session_id, user_id)
);
ALTER TABLE public.raid_participations ENABLE ROW LEVEL SECURITY;
CREATE POLICY raid_part_select_own ON public.raid_participations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY raid_part_select_staff ON public.raid_participations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
CREATE POLICY raid_part_insert_own ON public.raid_participations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT ON public.raid_participations TO authenticated;
GRANT ALL ON public.raid_participations TO service_role;
CREATE INDEX IF NOT EXISTS raid_part_session_idx ON public.raid_participations (session_id);

INSERT INTO public.platform_settings (key, value) VALUES
  ('raid_settings', '{"enabled":true,"boost_multiplier":3.0,"completion_reward":20,"participation_reward":5}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 4. Post boosts (My Posts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.post_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_days integer NOT NULL CHECK (plan_days IN (1, 3, 7)),
  multiplier numeric NOT NULL DEFAULT 3.0,
  price integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.post_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_boosts_select_own ON public.post_boosts FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY post_boosts_select_staff ON public.post_boosts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
CREATE POLICY post_boosts_insert_own ON public.post_boosts FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
GRANT SELECT, INSERT ON public.post_boosts TO authenticated;
GRANT ALL ON public.post_boosts TO service_role;
CREATE INDEX IF NOT EXISTS post_boosts_active_idx ON public.post_boosts (status, expires_at);

INSERT INTO public.platform_settings (key, value) VALUES
  ('boost_pricing', '{"1_day":150,"3_day":400,"7_day":800}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 5. Leaderboard
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leaderboard_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL CHECK (period IN ('daily','weekly','monthly','referral')),
  rank integer NOT NULL CHECK (rank BETWEEN 1 AND 10),
  reward_points integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period, rank)
);
ALTER TABLE public.leaderboard_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY lb_rewards_select_all ON public.leaderboard_rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY lb_rewards_staff_all ON public.leaderboard_rewards FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
GRANT SELECT ON public.leaderboard_rewards TO authenticated;
GRANT ALL ON public.leaderboard_rewards TO service_role;

CREATE TABLE IF NOT EXISTS public.leaderboard_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL CHECK (period IN ('daily','weekly','monthly','referral')),
  period_start date NOT NULL,
  rank integer NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_points integer NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL UNIQUE,
  awarded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leaderboard_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY lb_awards_select_staff ON public.leaderboard_awards FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
GRANT SELECT ON public.leaderboard_awards TO authenticated;
GRANT ALL ON public.leaderboard_awards TO service_role;

-- ============================================================
-- 6. Notification preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app jsonb NOT NULL DEFAULT '{}'::jsonb,
  email jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_prefs_select_own ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notif_prefs_update_own ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

COMMIT;