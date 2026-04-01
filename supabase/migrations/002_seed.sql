-- ============================================
-- LATIDO — Phase 1: Seed Data
-- Run AFTER 001_schema.sql succeeds
-- ============================================

-- Projects
INSERT INTO public.projects (user_id, name, status, hours_per_week_needed, priority) VALUES
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Latido', 'active', 8, 1),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Nouvie', 'active', 5, 2),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'MujerTech Module 2', 'active', 4, 2),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'ComadreLab Clients', 'active', 6, 3),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Cascadia AI Collective', 'paused', 2, 4),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'CascadiaJS 2026 Scholarships', 'active', 10, 5),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Anzuelo', 'paused', NULL, 5),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'SonetoBot', 'active', 1, 4),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'AI Agents Course', 'wishlist', NULL, 3);

-- Commitments
INSERT INTO public.commitments (user_id, name, hours_per_week, category, starts_at, ends_at, active) VALUES
  ('73305d0c-6897-44b8-9026-08d308deee62', 'InterRAI/Orkidea weekly calls', 3, 'client', '2025-01-01', NULL, TRUE),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'SonetoBot daily maintenance', 1, 'product', '2024-01-01', NULL, TRUE),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Cascadia AI meetup planning', 2, 'community', '2025-06-01', NULL, TRUE);

-- Tasks
INSERT INTO public.tasks (user_id, title, status, category, energy_level, estimated_minutes, project_id) VALUES
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Design Latido Capture screen', 'inbox', 'deep_work', 'high', 120,
    (SELECT id FROM public.projects WHERE name = 'Latido' AND user_id = '73305d0c-6897-44b8-9026-08d308deee62' LIMIT 1)),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Send invoice to Mario', 'inbox', 'admin', 'low', 15,
    (SELECT id FROM public.projects WHERE name = 'ComadreLab Clients' AND user_id = '73305d0c-6897-44b8-9026-08d308deee62' LIMIT 1)),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Review Nouvie PromoMix feature PR', 'inbox', 'client_work', 'medium', 45,
    (SELECT id FROM public.projects WHERE name = 'Nouvie' AND user_id = '73305d0c-6897-44b8-9026-08d308deee62' LIMIT 1)),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Write MujerTech Module 2 lesson plan', 'inbox', 'deep_work', 'high', 90,
    (SELECT id FROM public.projects WHERE name = 'MujerTech Module 2' AND user_id = '73305d0c-6897-44b8-9026-08d308deee62' LIMIT 1)),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Update Cascadia landing page events section', 'inbox', 'maintenance', 'low', 30,
    (SELECT id FROM public.projects WHERE name = 'Cascadia AI Collective' AND user_id = '73305d0c-6897-44b8-9026-08d308deee62' LIMIT 1)),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Fix SonetoBot CRON timing issue', 'inbox', 'maintenance', 'medium', 45,
    (SELECT id FROM public.projects WHERE name = 'SonetoBot' AND user_id = '73305d0c-6897-44b8-9026-08d308deee62' LIMIT 1)),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Respond to n8n ambassador program follow-up', 'inbox', 'admin', 'low', 15, NULL),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Grocery shopping', 'inbox', 'personal', 'low', 45, NULL),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Draft Latido MCP server tools', 'inbox', 'deep_work', 'high', 90,
    (SELECT id FROM public.projects WHERE name = 'Latido' AND user_id = '73305d0c-6897-44b8-9026-08d308deee62' LIMIT 1)),
  ('73305d0c-6897-44b8-9026-08d308deee62', 'Prepare ComadreLab client presentation', 'inbox', 'client_work', 'high', 60,
    (SELECT id FROM public.projects WHERE name = 'ComadreLab Clients' AND user_id = '73305d0c-6897-44b8-9026-08d308deee62' LIMIT 1));

-- User Settings
INSERT INTO public.user_settings (user_id, timezone, locale, planning_time, work_hours_start, work_hours_end, notification_channel) VALUES
  ('73305d0c-6897-44b8-9026-08d308deee62', 'America/Los_Angeles', 'es-MX', 'evening', '08:00', '18:00', 'telegram');
