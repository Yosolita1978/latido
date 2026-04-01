-- ============================================
-- LATIDO — Phase 1: Data Model
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- 1.1 Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1.2 Tables (in dependency order)
-- ============================================

-- 1. User Settings
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
  locale TEXT NOT NULL DEFAULT 'es-MX',
  planning_time TEXT NOT NULL DEFAULT 'evening' CHECK (planning_time IN ('morning', 'evening')),
  work_hours_start TIME NOT NULL DEFAULT '08:00',
  work_hours_end TIME NOT NULL DEFAULT '18:00',
  max_daily_tasks INTEGER DEFAULT NULL,
  notification_channel TEXT NOT NULL DEFAULT 'telegram' CHECK (notification_channel IN ('push', 'telegram', 'whatsapp', 'email')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own settings" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id);

-- 2. Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'blocked', 'wishlist')),
  hours_per_week_needed NUMERIC(5,2) DEFAULT NULL,
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  blocked_by UUID DEFAULT NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id);

-- 3. Commitments
CREATE TABLE public.commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hours_per_week NUMERIC(5,2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('learning', 'client', 'product', 'community')),
  project_id UUID DEFAULT NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  starts_at DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_at DATE DEFAULT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own commitments" ON public.commitments
  FOR ALL USING (auth.uid() = user_id);

-- 4. Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'scheduled', 'in_progress', 'completed', 'deferred', 'cancelled')),
  category TEXT NOT NULL DEFAULT 'admin' CHECK (category IN ('admin', 'client_work', 'deep_work', 'learning', 'personal', 'maintenance')),
  energy_level TEXT NOT NULL DEFAULT 'medium' CHECK (energy_level IN ('low', 'medium', 'high')),
  estimated_minutes INTEGER DEFAULT NULL,
  actual_minutes INTEGER DEFAULT NULL,
  project_id UUID DEFAULT NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  commitment_id UUID DEFAULT NULL REFERENCES public.commitments(id) ON DELETE SET NULL,
  due_date DATE DEFAULT NULL,
  recurrence_rule TEXT DEFAULT NULL,
  deferred_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  title_search TSVECTOR GENERATED ALWAYS AS (to_tsvector('spanish', title)) STORED,
  embedding VECTOR(768) DEFAULT NULL
);

CREATE INDEX idx_tasks_title_search ON public.tasks USING GIN (title_search);
CREATE INDEX idx_tasks_embedding ON public.tasks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_tasks_user_status ON public.tasks (user_id, status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);

-- 5. Daily Plans
CREATE TABLE public.daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  time_blocks JSONB NOT NULL DEFAULT '[]',
  total_planned_minutes INTEGER NOT NULL DEFAULT 0,
  total_completed_minutes INTEGER DEFAULT NULL,
  completion_rate NUMERIC(5,2) DEFAULT NULL,
  mood TEXT DEFAULT NULL,
  reflection TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);

ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own plans" ON public.daily_plans
  FOR ALL USING (auth.uid() = user_id);

-- 6. User Patterns (DIY Memory Bank)
CREATE TABLE public.user_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_key TEXT NOT NULL,
  pattern_value JSONB NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 1,
  embedding VECTOR(768) NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patterns_embedding ON public.user_patterns USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_patterns_user ON public.user_patterns (user_id);
CREATE INDEX idx_patterns_user_key ON public.user_patterns (user_id, pattern_key);

ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own patterns" ON public.user_patterns
  FOR ALL USING (auth.uid() = user_id);

-- 7. Capture Inbox
CREATE TABLE public.capture_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  media_url TEXT DEFAULT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'voice', 'photo')),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inbox_unprocessed ON public.capture_inbox (user_id, processed) WHERE processed = FALSE;

ALTER TABLE public.capture_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own inbox" ON public.capture_inbox
  FOR ALL USING (auth.uid() = user_id);
