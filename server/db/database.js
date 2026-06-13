const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const DB_PATH = process.env.DB_PATH || './db/healthos.db';
const dbDir = path.dirname(DB_PATH);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  // Split by semicolons to run each statement
  const statements = schema.split(';').filter(s => s.trim().length > 0);
  for (const stmt of statements) {
    try {
      db.prepare(stmt).run();
    } catch (e) {
      // Ignore duplicate inserts
      if (!e.message.includes('UNIQUE constraint')) {
        console.error('Schema error:', e.message, '\nStatement:', stmt.slice(0, 80));
      }
    }
  }
  migrateSchema();
}

function migrateSchema() {
  try {
    const metricsInfo = db.prepare("PRAGMA table_info(report_metrics)").all();
    const hasConfidence = metricsInfo.some(col => col.name === 'confidence');
    const hasSource = metricsInfo.some(col => col.name === 'source');

    if (!hasConfidence) {
      db.prepare("ALTER TABLE report_metrics ADD COLUMN confidence REAL DEFAULT 1.0").run();
      console.log("✅ Migration: Added 'confidence' to report_metrics");
    }
    if (!hasSource) {
      db.prepare("ALTER TABLE report_metrics ADD COLUMN source TEXT DEFAULT 'text_pdf'").run();
      console.log("✅ Migration: Added 'source' to report_metrics");
    }

    // Reports table enrichment
    const reportsInfo = db.prepare("PRAGMA table_info(reports)").all();
    const hasProcessingMeta = reportsInfo.some(col => col.name === 'processing_meta');
    if (!hasProcessingMeta) {
      db.prepare("ALTER TABLE reports ADD COLUMN processing_meta TEXT DEFAULT NULL").run();
      console.log("✅ Migration: Added 'processing_meta' to reports");
    }
  } catch (err) {
    console.error("❌ Migration error:", err.message);
  }
}

module.exports = { getDb };
