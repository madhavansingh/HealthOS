require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = process.env.UPLOADS_DIR || './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const isVercel = /\.vercel\.app$/.test(origin);
    const isAllowedCustom = process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.split(',').includes(origin);
    if (isLocalhost || isVercel || isAllowedCustom) {
      callback(null, true);
    } else {
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200, // Safari compatibility
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Initialize database on startup
const { getDb } = require('./db/database');
try {
  getDb();
  console.log('✅ Database initialized');
} catch (e) {
  console.error('❌ Database initialization failed:', e.message);
}

// Routes
const reportsRouter = require('./routes/reports');
const insightsRouter = require('./routes/insights');
const chatRouter = require('./routes/chat');
const dashboardRouter = require('./routes/dashboard');
const combinedRouter = require('./routes/combined');

app.use('/api/reports', reportsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/dashboard', dashboardRouter);

// Combined routes
app.use('/api/copilot', combinedRouter);
app.use('/api/graph', combinedRouter);
app.use('/api/simulator', combinedRouter);
app.use('/api/timeline', combinedRouter);
app.use('/api/preventive', combinedRouter);
app.use('/api/family', combinedRouter);
app.use('/api/journey', combinedRouter);

// New AI endpoints
const { generateMissionControl, generateTwinHistory, getDemoMissionControl, getDemoTwinHistory } = require('./agents/additionalAgents');

app.get('/api/mission-control', async (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default-user');
    const metrics = db.prepare(`
      SELECT metric_name, value, unit, status FROM report_metrics
      WHERE report_id IN (SELECT id FROM reports WHERE user_id = 'default-user' AND status IN ('analyzed', 'partial'))
      ORDER BY created_at DESC LIMIT 30
    `).all();
    const insights = db.prepare(`
      SELECT i.* FROM ai_insights i
      JOIN reports r ON r.id = i.report_id
      WHERE i.user_id = ? AND r.status IN ('analyzed', 'partial')
      LIMIT 10
    `).all('default-user');
    
    if (metrics.length === 0) {
      return res.json([]);
    }
    const actions = await generateMissionControl(user, metrics, insights);
    res.json(actions);
  } catch (err) {
    console.error('Mission control error:', err.message);
    res.json([]);
  }
});

app.get('/api/twin/history', async (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default-user');
    const scoreHistory = db.prepare('SELECT * FROM health_scores WHERE user_id = ? ORDER BY date').all('default-user');
    const healthEvents = db.prepare(`
      SELECT e.* FROM health_events e
      LEFT JOIN reports r ON r.id = e.report_id
      WHERE e.user_id = ? AND (r.id IS NULL OR r.status IN ('analyzed', 'partial'))
      ORDER BY e.date DESC
    `).all('default-user');
    
    if (scoreHistory.length === 0) {
      return res.json({ scoreHistory: [], healthEvents: [] });
    }
    const history = await generateTwinHistory(user, scoreHistory, healthEvents);
    res.json(history);
  } catch (err) {
    console.error('Twin history error:', err.message);
    res.json({ scoreHistory: [], healthEvents: [] });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
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
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Max 20MB.' });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 HealthOS Backend running on http://localhost:${PORT}`);
  console.log(`📊 API health: http://localhost:${PORT}/api/health`);
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your_gemini_api_key_here') {
    console.log('\n⚠️  GEMINI_API_KEY not set! Add your key to server/.env');
    console.log('   Get a key at: https://aistudio.google.com/apikey');
  } else {
    console.log('✅ Gemini API key configured');
  }
  console.log('');
});

module.exports = app;
