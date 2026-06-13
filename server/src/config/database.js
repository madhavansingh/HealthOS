const path = require('path');
const fs = require('fs');
const env = require('./environment');

// Resolve database path relative to the server/ directory
const dbPath = path.resolve(__dirname, '../../../', env.DB_PATH);
const dbDir = path.dirname(dbPath);

// Ensure the target database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

module.exports = {
  dbPath,
  journalMode: 'WAL',
  foreignKeys: true,
};
