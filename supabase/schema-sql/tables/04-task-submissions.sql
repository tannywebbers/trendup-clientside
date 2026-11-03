-- ============================================
-- TABLE: task_submissions
-- Description: User submissions for completing tasks
-- ============================================

-- Create task_status enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE public.task_status AS ENUM ('pending', 'approved', 'rejected', 'needs_review');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ad_id uuid NOT NULL REFERENCES public.ads(id),
  screenshot_urls text[] NOT NULL DEFAULT '{}',
  status public.task_status NOT NULL DEFAULT 'pending',
  ai_analysis jsonb,
  admin_notes text,
  points_awarded integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_task_submissions_user_id ON public.task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_ad_id ON public.task_submissions(ad_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_status ON public.task_submissions(status);

COMMENT ON TABLE public.task_submissions IS 'Task completion submissions from users';
