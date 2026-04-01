-- ============================================
-- LATIDO — Phase 1: Verification
-- Run AFTER 001_schema.sql and 002_seed.sql
-- ============================================

-- Verify pgvector
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Verify all 7 tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Verify RLS policies
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

-- Verify seed data counts (expected: projects=9, commitments=3, tasks=10, user_settings=1)
SELECT 'projects' AS table_name, COUNT(*) AS row_count FROM public.projects
UNION ALL SELECT 'commitments', COUNT(*) FROM public.commitments
UNION ALL SELECT 'tasks', COUNT(*) FROM public.tasks
UNION ALL SELECT 'user_settings', COUNT(*) FROM public.user_settings;

-- Verify indexes
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
