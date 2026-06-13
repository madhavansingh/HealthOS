const path = require('path');

// Try to load .env from the root directory, fallback to server/ directory
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'your_gemini_api_key_here',
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_PATH: process.env.DB_PATH || './src/database/healthos.db',
  UPLOADS_DIR: process.env.UPLOADS_DIR || '../storage/uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '20971520', 10),
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [],
};

module.exports = config;
