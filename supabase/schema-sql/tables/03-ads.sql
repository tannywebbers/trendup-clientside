-- ============================================
-- TABLE: ads
-- Description: Task advertisements created by users
-- ============================================

-- Create task_type enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
    CREATE TYPE public.task_type AS ENUM ('like', 'comment', 'save', 'watch', 'follow', 'combo_mini', 'combo_large');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  task_type public.task_type NOT NULL,
  tiktok_post_url text NOT NULL,
  video_description text,
  screenshot_example_url text,
  comment_keywords text[],
  points_per_task integer NOT NULL DEFAULT 10,
  required_completions integer NOT NULL DEFAULT 10,
  completed_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ads_creator_id ON public.ads(creator_id);
CREATE INDEX IF NOT EXISTS idx_ads_is_active ON public.ads(is_active);
CREATE INDEX IF NOT EXISTS idx_ads_task_type ON public.ads(task_type);

COMMENT ON TABLE public.ads IS 'Task advertisements for TikTok engagement';
