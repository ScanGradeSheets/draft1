CREATE TABLE IF NOT EXISTS class_roster (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'review', 'done')),
  digits_json TEXT NOT NULL,
  confidences_json TEXT NOT NULL,
  correct_json TEXT,
  avg_confidence REAL,
  total_time TEXT,
  template_id TEXT,
  sheet_instance_id TEXT,
  needs_review INTEGER NOT NULL DEFAULT 0,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_student_saved_at
  ON submissions (student_name, saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_status_saved_at
  ON submissions (status, saved_at DESC);
