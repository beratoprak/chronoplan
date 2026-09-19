-- ============================================================
-- Epoche v3 — Dijital ajanda zamanlama alanları
-- Yalnızca eklemeli migration: mevcut kolonlara ve kayıtlara dokunmaz.
-- ============================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_start_time text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_end_time text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS focus_date text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none';

-- Eski `date` alanını hem son tarih hem plan tarihi olarak kullanan kayıtlar
-- yeni modele kopyalanır. Eski alan bilerek korunur ve silinmez.
UPDATE tasks
SET
  due_date = COALESCE(due_date, date),
  scheduled_date = COALESCE(scheduled_date, date)
WHERE date IS NOT NULL;

ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS task_id text;

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
  ON tasks (user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_schedule
  ON tasks (user_id, scheduled_date, scheduled_start_time);
CREATE INDEX IF NOT EXISTS idx_work_sessions_task
  ON work_sessions (user_id, task_id);

COMMENT ON COLUMN tasks.date IS
  'Legacy compatibility field. Do not remove; new clients use due_date and scheduled_date.';
