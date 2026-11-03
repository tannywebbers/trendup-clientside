-- ============================================
-- RLS.SQL - Row Level Security Policies
-- ============================================
-- Run AFTER tables.sql, functions.sql, triggers.sql
-- Safe to re-run: drops policies before recreation
-- ============================================

-- ============================================
-- PROFILES RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Service role bypass" ON public.profiles;

-- Allow viewing all profiles (for leaderboards, referral displays)
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- Allow trigger to insert profiles
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can manage all profiles
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- USER_ROLES RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- ADS RLS
-- ============================================

DROP POLICY IF EXISTS "Anyone can view active ads" ON public.ads;
DROP POLICY IF EXISTS "Users can create own ads" ON public.ads;
DROP POLICY IF EXISTS "Users can update own ads" ON public.ads;
DROP POLICY IF EXISTS "Users can delete own ads" ON public.ads;
DROP POLICY IF EXISTS "Admins can manage all ads" ON public.ads;

CREATE POLICY "Anyone can view active ads"
  ON public.ads FOR SELECT
  USING (is_active = true OR auth.uid() = creator_id);

CREATE POLICY "Users can create own ads"
  ON public.ads FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own ads"
  ON public.ads FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can delete own ads"
  ON public.ads FOR DELETE
  USING (auth.uid() = creator_id);

CREATE POLICY "Admins can manage all ads"
  ON public.ads FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- TASK_SUBMISSIONS RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view own submissions" ON public.task_submissions;
DROP POLICY IF EXISTS "Users can create submissions" ON public.task_submissions;
DROP POLICY IF EXISTS "Admins can manage all submissions" ON public.task_submissions;
DROP POLICY IF EXISTS "Moderators can view submissions" ON public.task_submissions;

CREATE POLICY "Users can view own submissions"
  ON public.task_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create submissions"
  ON public.task_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all submissions"
  ON public.task_submissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view submissions"
  ON public.task_submissions FOR SELECT
  USING (public.has_role(auth.uid(), 'moderator'));

-- ============================================
-- TRANSACTIONS RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- REFERRALS RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Admins can view all referrals" ON public.referrals;

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (
    referrer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    referred_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all referrals"
  ON public.referrals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- REFERRAL_COMMISSIONS RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view own commissions" ON public.referral_commissions;
DROP POLICY IF EXISTS "Admins can view all commissions" ON public.referral_commissions;

CREATE POLICY "Users can view own commissions"
  ON public.referral_commissions FOR SELECT
  USING (
    referrer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all commissions"
  ON public.referral_commissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- NOTIFICATIONS RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage notifications"
  ON public.notifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- CHAT_SESSIONS RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can create chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Admins/moderators can manage chats" ON public.chat_sessions;

CREATE POLICY "Users can view own chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create chat sessions"
  ON public.chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
  ON public.chat_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins/moderators can manage chats"
  ON public.chat_sessions FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'moderator')
  );

-- ============================================
-- CHAT_MESSAGES RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can create messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admins/moderators can manage messages" ON public.chat_messages;

CREATE POLICY "Users can view own messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins/moderators can manage messages"
  ON public.chat_messages FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'moderator')
  );

-- ============================================
-- SETTINGS TABLES RLS (Public read, Admin write)
-- ============================================

-- App Settings
DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can manage app settings" ON public.app_settings;

CREATE POLICY "Anyone can view app settings"
  ON public.app_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage app settings"
  ON public.app_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Platform Settings
DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admins can manage platform settings" ON public.platform_settings;

CREATE POLICY "Anyone can view platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage platform settings"
  ON public.platform_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Landing Content
DROP POLICY IF EXISTS "Anyone can view landing content" ON public.landing_content;
DROP POLICY IF EXISTS "Admins can manage landing content" ON public.landing_content;

CREATE POLICY "Anyone can view landing content"
  ON public.landing_content FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage landing content"
  ON public.landing_content FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Ad Settings
DROP POLICY IF EXISTS "Anyone can view ad settings" ON public.ad_settings;
DROP POLICY IF EXISTS "Admins can manage ad settings" ON public.ad_settings;

CREATE POLICY "Anyone can view ad settings"
  ON public.ad_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage ad settings"
  ON public.ad_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- ADMIN-ONLY TABLES RLS
-- ============================================

-- Moderator Permissions
DROP POLICY IF EXISTS "Admins can manage moderator permissions" ON public.moderator_permissions;
DROP POLICY IF EXISTS "Moderators can view own permissions" ON public.moderator_permissions;

CREATE POLICY "Admins can manage moderator permissions"
  ON public.moderator_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view own permissions"
  ON public.moderator_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Moderator Activity Logs
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.moderator_activity_logs;

CREATE POLICY "Admins can view activity logs"
  ON public.moderator_activity_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin TOTP Secrets
DROP POLICY IF EXISTS "Admins can manage TOTP" ON public.admin_totp_secrets;

CREATE POLICY "Admins can manage TOTP"
  ON public.admin_totp_secrets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin Login Attempts
DROP POLICY IF EXISTS "Admins can view login attempts" ON public.admin_login_attempts;

CREATE POLICY "Admins can view login attempts"
  ON public.admin_login_attempts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- SMTP Config
DROP POLICY IF EXISTS "Admins can manage SMTP" ON public.smtp_config;

CREATE POLICY "Admins can manage SMTP"
  ON public.smtp_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- AI Config
DROP POLICY IF EXISTS "Admins can manage AI config" ON public.ai_config;

CREATE POLICY "Admins can manage AI config"
  ON public.ai_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- AI Prompts
DROP POLICY IF EXISTS "Admins can manage AI prompts" ON public.ai_prompts;

CREATE POLICY "Admins can manage AI prompts"
  ON public.ai_prompts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Allowed Email Domains
DROP POLICY IF EXISTS "Admins can manage email domains" ON public.allowed_email_domains;

CREATE POLICY "Admins can manage email domains"
  ON public.allowed_email_domains FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- VERIFICATION TABLES RLS
-- ============================================

-- Email Verifications
DROP POLICY IF EXISTS "Users can view own email verifications" ON public.email_verifications;
DROP POLICY IF EXISTS "Admins can manage email verifications" ON public.email_verifications;

CREATE POLICY "Users can view own email verifications"
  ON public.email_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage email verifications"
  ON public.email_verifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Follow Verifications
DROP POLICY IF EXISTS "Users can view own follow verifications" ON public.follow_verifications;
DROP POLICY IF EXISTS "Admins can manage follow verifications" ON public.follow_verifications;

CREATE POLICY "Users can view own follow verifications"
  ON public.follow_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage follow verifications"
  ON public.follow_verifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Generated Comments
DROP POLICY IF EXISTS "Users can view own generated comments" ON public.generated_comments;
DROP POLICY IF EXISTS "Users can create generated comments" ON public.generated_comments;
DROP POLICY IF EXISTS "Admins can manage generated comments" ON public.generated_comments;

CREATE POLICY "Users can view own generated comments"
  ON public.generated_comments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create generated comments"
  ON public.generated_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage generated comments"
  ON public.generated_comments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- DONE - RLS Policies created successfully
-- ============================================
