const path = require('path');
const fs = require('fs');
const env = require('./environment');

// Resolve local storage paths relative to the server location
const uploadsDir = path.resolve(__dirname, '../../', env.UPLOADS_DIR);
const demoDocsDir = path.resolve(__dirname, '../../../storage/demo-documents');

// Ensure that storage folders are created on startup
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

module.exports = {
  uploadsDir,
  demoDocsDir,
  maxFileSize: env.MAX_FILE_SIZE,
  supportedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
};
