const env = require('./config/environment');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const corsOptions = require('./config/cors');
const { getDb } = require('./database/connection');

const app = express();
const PORT = env.PORT || 3001;

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Initialize database on startup
try {
  getDb();
  console.log('✅ Database initialized and schema verified');
} catch (e) {
  console.error('❌ Database initialization failed:', e.message);
}

// Routers
const reportsRouter = require('./routes/reports');
const insightsRouter = require('./routes/insights');
const chatRouter = require('./routes/chat');
const dashboardRouter = require('./routes/dashboard');
const copilotRouter = require('./routes/copilot');
const graphRouter = require('./routes/graph');
const simulatorRouter = require('./routes/simulator');
const timelineRouter = require('./routes/timeline');
const preventiveRouter = require('./routes/preventive');
const familyRouter = require('./routes/family');
const journeyRouter = require('./routes/journey');

const SimulatorController = require('./controllers/simulatorController');

app.use('/api/reports', reportsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/copilot', copilotRouter);
app.use('/api/graph', graphRouter);
app.use('/api/simulator', simulatorRouter);
app.use('/api/timeline', timelineRouter);
app.use('/api/preventive', preventiveRouter);
app.use('/api/family', familyRouter);
app.use('/api/journey', journeyRouter);

// Directly mounted controllers on main application
app.get('/api/mission-control', SimulatorController.getMissionControl);
app.get('/api/twin/history', SimulatorController.getTwinHistory);

// Health check
app.get('/api/health', (req, res) => {
  const geminiKey = env.GEMINI_API_KEY;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    gemini: geminiKey && geminiKey !== 'your_gemini_api_key_here' ? 'configured' : 'not_configured',
    version: '2.0.0',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Express error:', err.message);

  // 1. CORS Rejection
  if (err.message === 'Not allowed by CORS') {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    return res.status(403).json({ error: 'CORS rejection: Origin not allowed' });
  }

  // 2. File too large (Multer limit)
  if (err.code === 'LIMIT_FILE_SIZE') {
    const maxMb = Math.round(env.MAX_FILE_SIZE / (1024 * 1024)) || 20;
    return res.status(400).json({ error: `File too large. Max ${maxMb}MB.` });
  }

  // 3. Unsupported file type (Multer filter)
  if (err.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({ error: err.message });
  }

  // 4. Other Multer errors (e.g., unexpected field)
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  // 5. Catch-all Internal Server Error
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 HealthOS Backend running on http://localhost:${PORT}`);
  console.log(`📊 API health: http://localhost:${PORT}/api/health`);
  const key = env.GEMINI_API_KEY;
  if (!key || key === 'your_gemini_api_key_here') {
    console.log('\n⚠️  GEMINI_API_KEY not set! Add your key to server/.env');
    console.log('   Get a key at: https://aistudio.google.com/apikey');
  } else {
    console.log('✅ Gemini API key configured');
  }
  console.log('');
});

module.exports = app;
