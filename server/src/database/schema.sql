-- HealthOS SQLite Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT 'default-user',
  name TEXT NOT NULL DEFAULT 'Arjun Mehta',
  email TEXT,
  age INTEGER DEFAULT 34,
  gender TEXT DEFAULT 'Male',
  blood_type TEXT DEFAULT 'O+',
  height TEXT DEFAULT '5''11"',
  weight TEXT DEFAULT '78 kg',
  location TEXT DEFAULT 'Mumbai, India',
  primary_doctor TEXT DEFAULT 'Dr. Priya Sharma',
  plan TEXT DEFAULT 'HealthOS Pro',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default-user',
  name TEXT NOT NULL,
  type TEXT,
  lab TEXT,
  file_path TEXT,
  file_name TEXT,
  status TEXT DEFAULT 'processing',
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  analyzed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS report_metrics (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value REAL,
  value_text TEXT,
  unit TEXT,
  reference_low REAL,
  reference_high REAL,
  status TEXT DEFAULT 'normal',
  category TEXT,
  confidence REAL DEFAULT 1.0,
  source TEXT DEFAULT 'text_pdf',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS ai_insights (
  id TEXT PRIMARY KEY,
  report_id TEXT,
  user_id TEXT DEFAULT 'default-user',
  category TEXT,
  severity TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT,
  metric TEXT,
  icon TEXT DEFAULT 'activity',
  sources TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS vitals_timeline (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default-user',
  report_id TEXT,
  date TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value REAL,
  unit TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS health_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default-user',
  date TEXT NOT NULL,
  overall INTEGER,
  cardiovascular INTEGER,
  metabolic INTEGER,
  sleep INTEGER,
  activity INTEGER,
  mental INTEGER,
  nutrition INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT DEFAULT 'default-user',
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS health_events (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default-user',
  report_id TEXT,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default-user',
  name TEXT NOT NULL,
  relation TEXT,
  age INTEGER,
  score INTEGER DEFAULT 75,
  conditions TEXT DEFAULT '[]',
  last_checkup TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS preventive_care (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default-user',
  title TEXT NOT NULL,
  due TEXT,
  priority TEXT DEFAULT 'medium',
  reason TEXT,
  specialist TEXT,
  done INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default user
INSERT OR IGNORE INTO users (id, name, email, age, gender, blood_type)
VALUES ('default-user', 'Health Twin', '', null, '', '');
