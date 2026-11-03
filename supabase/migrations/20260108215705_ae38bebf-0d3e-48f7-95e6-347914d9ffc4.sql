-- Seed AI prompts for all task types
INSERT INTO public.ai_prompts (task_type, prompt_name, prompt_content, confidence_threshold, is_active) VALUES
('like', 'Like Verification', 'Verify that the heart/like icon is filled (red/pink color) indicating the post has been liked. Check for authentic TikTok UI elements.', 75, true),
('comment', 'Comment Verification', 'Verify that a comment from the specified username exists in the comment section. The comment should be visible and match the expected text if provided.', 70, true),
('save', 'Save Verification', 'Verify that the bookmark/save icon is filled (yellow/gold color) indicating the post has been saved. Check for authentic TikTok UI.', 75, true),
('follow', 'Follow Verification', 'Verify that the Follow button shows "Following" state (not "Follow" or "Follow back"). The username should match the advertiser profile.', 80, true),
('combo_mini', 'Combo Mini Verification', 'Verify all three actions: Like (red heart), Comment (from specified user), and Save (yellow bookmark). All actions must be completed.', 70, true),
('combo_large', 'Combo Large Verification', 'Verify all four actions: Like (red heart), Comment (from specified user), Save (yellow bookmark), and Follow (showing "Following"). All must be completed.', 70, true)
ON CONFLICT (task_type) DO UPDATE SET
  prompt_name = EXCLUDED.prompt_name,
  prompt_content = EXCLUDED.prompt_content,
  confidence_threshold = EXCLUDED.confidence_threshold;

-- Add unique constraint on task_type if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_prompts_task_type_key') THEN
    ALTER TABLE public.ai_prompts ADD CONSTRAINT ai_prompts_task_type_key UNIQUE (task_type);
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Seed initial SMTP config (disabled by default)
INSERT INTO public.smtp_config (host, port, username, from_email, from_name, is_enabled, password_set) VALUES
('smtp.example.com', 587, '', 'noreply@example.com', 'TikPoints', false, false)
ON CONFLICT DO NOTHING;

-- Add email verification setting to platform_settings
INSERT INTO public.platform_settings (key, value) VALUES
('email_verification', '{"enabled": false, "require_verification": false}'::jsonb),
('site_settings', '{"site_name": "TikPoints", "site_logo": "", "support_email": "support@tikpoints.com", "maintenance_mode": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add unique constraint on platform_settings key if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_key_unique') THEN
    ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_key_unique UNIQUE (key);
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;