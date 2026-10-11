PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS month_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month_key TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  salary_amount REAL NOT NULL DEFAULT 0,
  opening_balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, month_key)
);
CREATE TABLE IF NOT EXISTS budget_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  section TEXT NOT NULL,
  title TEXT,
  amount REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  month_key TEXT NOT NULL,
  label TEXT
);
CREATE INDEX IF NOT EXISTS budget_items_user_month ON budget_items(user_id, month_key, section, sort_order);
CREATE TABLE IF NOT EXISTS custom_budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS custom_budget_sections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  budget_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  include_in_total INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS custom_sections_budget ON custom_budget_sections(user_id, budget_id, sort_order);
CREATE TABLE IF NOT EXISTS custom_budget_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  budget_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS custom_items_budget ON custom_budget_items(user_id, budget_id, sort_order);
