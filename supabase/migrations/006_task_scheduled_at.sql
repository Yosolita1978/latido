-- Add scheduled_at column to tasks for user-set scheduling outside the AI plan
-- A task with scheduled_at appears on /hoy under "Capturadas hoy" with its time.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at
  ON tasks(user_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;
