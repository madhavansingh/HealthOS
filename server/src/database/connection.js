const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dbConfig = require('../config/database');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(dbConfig.dbPath);
    if (dbConfig.journalMode) {
      dbInstance.pragma(`journal_mode = ${dbConfig.journalMode}`);
    }
    if (dbConfig.foreignKeys) {
      dbInstance.pragma('foreign_keys = ON');
    }
    initSchema();
  }
  return dbInstance;
}

function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.warn(`[Database] schema.sql not found at ${schemaPath}`);
    return;
  }
  
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  // Split statements by semicolon and run sequentially
  const statements = schema.split(';').filter(s => s.trim().length > 0);
  for (const stmt of statements) {
    try {
      dbInstance.prepare(stmt).run();
    } catch (e) {
      // Ignore duplicate seed errors
      if (!e.message.includes('UNIQUE constraint')) {
        console.error('Schema error:', e.message, '\nStatement:', stmt.slice(0, 80));
      }
    }
  }
  migrateSchema();
}

function migrateSchema() {
  try {
    const metricsInfo = dbInstance.prepare("PRAGMA table_info(report_metrics)").all();
    const hasConfidence = metricsInfo.some(col => col.name === 'confidence');
    const hasSource = metricsInfo.some(col => col.name === 'source');

    if (!hasConfidence) {
      dbInstance.prepare("ALTER TABLE report_metrics ADD COLUMN confidence REAL DEFAULT 1.0").run();
      console.log("✅ Migration: Added 'confidence' to report_metrics");
    }
    if (!hasSource) {
      dbInstance.prepare("ALTER TABLE report_metrics ADD COLUMN source TEXT DEFAULT 'text_pdf'").run();
      console.log("✅ Migration: Added 'source' to report_metrics");
    }

    const reportsInfo = dbInstance.prepare("PRAGMA table_info(reports)").all();
    const hasProcessingMeta = reportsInfo.some(col => col.name === 'processing_meta');
    if (!hasProcessingMeta) {
      dbInstance.prepare("ALTER TABLE reports ADD COLUMN processing_meta TEXT DEFAULT NULL").run();
      console.log("✅ Migration: Added 'processing_meta' to reports");
    }
  } catch (err) {
    console.error("❌ Migration error:", err.message);
  }
}

module.exports = { getDb };
