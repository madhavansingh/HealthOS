const path = require('path');
const fs = require('fs');
const env = require('./environment');

const isVercel = !!(process.env.VERCEL || process.env.NOW_BUILDER);

let dbPath;
if (isVercel) {
  dbPath = '/tmp/healthos.db';
} else {
  const isDocker = process.cwd() === '/app' || fs.existsSync('/.dockerenv');
  if (isDocker) {
    dbPath = path.resolve(__dirname, '../../', env.DB_PATH);
  } else {
    dbPath = path.resolve(__dirname, '../../../', env.DB_PATH);
  }
}

const dbDir = path.dirname(dbPath);

// Ensure the target database directory exists
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create database directory ${dbDir}:`, err.message);
    if (!isVercel) {
      dbPath = '/tmp/healthos.db';
      const tmpDir = path.dirname(dbPath);
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    }
  }
}

module.exports = {
  dbPath,
  journalMode: isVercel ? 'DELETE' : 'WAL',
  foreignKeys: true,
};
