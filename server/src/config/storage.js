const path = require('path');
const fs = require('fs');
const env = require('./environment');

const isVercel = !!(process.env.VERCEL || process.env.NOW_BUILDER);

// Resolve local storage paths relative to the server location
const uploadsDir = isVercel
  ? '/tmp/uploads'
  : path.resolve(__dirname, '../../', env.UPLOADS_DIR);

const demoDocsDir = process.env.DEMO_DOCS_DIR
  ? path.resolve(process.env.DEMO_DOCS_DIR)
  : path.resolve(__dirname, '../../../storage/demo-documents');

// Ensure that storage folders are created on startup
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create uploads directory ${uploadsDir}:`, err.message);
  }
}

module.exports = {
  uploadsDir,
  demoDocsDir,
  maxFileSize: env.MAX_FILE_SIZE,
  supportedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
};
