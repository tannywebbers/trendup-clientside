-- Fix RLS policy on transactions to allow admins to insert for any user
DROP POLICY IF EXISTS "System can insert transactions" ON public.transactions;

CREATE POLICY "System can insert transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id OR 
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Seed landing_content if empty
INSERT INTO public.landing_content (section_key, title, subtitle, content, is_visible, sort_order)
SELECT * FROM (VALUES
  ('hero', 'Earn TikPoints by Engaging', 'Complete simple TikTok tasks and earn rewards', 'Join thousands of users earning points by liking, commenting, and following on TikTok.', true, 1),
  ('features', 'Why Choose TikPoints?', 'The easiest way to boost your TikTok engagement', 'AI-powered verification, instant rewards, secure payments.', true, 2),
  ('how_it_works', 'How It Works', '3 Simple Steps', 'Browse tasks, complete them, earn points. It''s that easy!', true, 3),
  ('stats', 'Our Numbers', 'Growing every day', 'Join our thriving community of creators and earners.', true, 4),
  ('cta', 'Ready to Start Earning?', 'Join TikPoints Today', 'Sign up now and get 50 bonus points!', true, 5)
) AS v(section_key, title, subtitle, content, is_visible, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.landing_content LIMIT 1);