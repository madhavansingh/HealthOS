const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { processReport, rebuildHealthScores } = require('../pipeline/reportProcessor');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const router = express.Router();

// Multer config
const storage = multer.diskStorage({
  destination: process.env.UPLOADS_DIR || './uploads',
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 20971520 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, PNG, WEBP files are supported'));
    }
  },
});

// POST /api/reports/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const db = getDb();
    const reportId = uuidv4();
    const reportName = req.body.name || path.basename(req.file.originalname, path.extname(req.file.originalname));

    // Create report record
    db.prepare(`
      INSERT INTO reports (id, user_id, name, file_path, file_name, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reportId, 'default-user', reportName, req.file.path, req.file.originalname, 'processing');

    // Process asynchronously (don't wait for AI)
    res.json({
      success: true,
      reportId,
      message: 'Report uploaded. AI analysis started...',
    });

    // Start pipeline in background
    processReport(reportId, req.file.path, 'default-user').catch(err => {
      console.error('Background pipeline error:', err.message);
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/analyze-demo
router.post('/analyze-demo', async (req, res) => {
  try {
    const { scenario } = req.body;
    if (!scenario) {
      return res.status(400).json({ error: 'Scenario is required' });
    }

    let srcFilename;
    let displayName;
    switch (scenario) {
      case 'healthy-adult':
        srcFilename = 'healthy-adult-report.pdf';
        displayName = 'Healthy Profile (Demo)';
        break;
      case 'vitamin-d':
        srcFilename = 'vitamin-d-deficiency-report.pdf';
        displayName = 'Vitamin D Deficiency (Demo)';
        break;
      case 'metabolic-risk':
        srcFilename = 'metabolic-risk-report.pdf';
        displayName = 'Metabolic Risk (Demo)';
        break;
      default:
        return res.status(400).json({ error: 'Invalid demo scenario' });
    }

    const fs = require('fs');
    const srcPath = path.join(__dirname, '../../assets/demo-documents', srcFilename);
    if (!fs.existsSync(srcPath)) {
      return res.status(404).json({ error: `Demo file not found at ${srcPath}` });
    }

    const reportId = uuidv4();
    const destFilename = `${reportId}-demo-${srcFilename}`;
    const destDir = process.env.UPLOADS_DIR || './uploads';
    
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    const destPath = path.join(destDir, destFilename);
    fs.copyFileSync(srcPath, destPath);

    const db = getDb();
    db.prepare(`
      INSERT INTO reports (id, user_id, name, file_path, file_name, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reportId, 'default-user', displayName, destPath, srcFilename, 'processing');

    res.json({
      success: true,
      reportId,
      message: 'Demo report loaded. AI analysis started...',
    });

    processReport(reportId, destPath, 'default-user').catch(err => {
      console.error('Background demo pipeline error:', err.message);
    });

  } catch (err) {
    console.error('Demo upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const reports = db.prepare(`
      SELECT r.*,
        COUNT(DISTINCT m.id) as metric_count,
        COUNT(DISTINCT i.id) as insight_count,
        COUNT(CASE WHEN m.status != 'normal' THEN 1 END) as abnormal_count
      FROM reports r
      LEFT JOIN report_metrics m ON m.report_id = r.id
      LEFT JOIN ai_insights i ON i.report_id = r.id
      WHERE r.user_id = 'default-user'
      GROUP BY r.id
      ORDER BY r.uploaded_at DESC
    `).all();

    // Format for frontend
    const formatted = reports.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type || 'General',
      date: formatDate(r.uploaded_at),
      status: r.status,
      lab: r.lab || 'Uploaded Lab',
      insights: r.insight_count || 0,
      abnormal: r.abnormal_count || 0,
      metricCount: r.metric_count || 0,
    }));

    res.json({ reports: formatted, total: formatted.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const metrics = db.prepare('SELECT * FROM report_metrics WHERE report_id = ? ORDER BY category, metric_name').all(req.params.id);
    const insights = db.prepare('SELECT * FROM ai_insights WHERE report_id = ? ORDER BY created_at DESC').all(req.params.id);

    res.json({
      report: {
        ...report,
        date: formatDate(report.uploaded_at),
      },
      metrics,
      insights,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/:id/status  — rich status for Processing UX
router.get('/:id/status', (req, res) => {
  const db = getDb();
  const report = db.prepare(
    'SELECT id, status, analyzed_at, type, processing_meta FROM reports WHERE id = ?'
  ).get(req.params.id);

  if (!report) return res.status(404).json({ error: 'Not found' });

  // Parse stored processing metadata
  let meta = {};
  try {
    if (report.processing_meta) meta = JSON.parse(report.processing_meta);
  } catch (_) {}

  // Always enrich with live metric counts if analyzed or partial
  let metricsPreview = meta.metricsPreview || [];
  let metricCount = 0;

  if (report.status === 'analyzed' || report.status === 'partial') {
    const metrics = db.prepare(
      'SELECT metric_name, value, value_text, unit, status, confidence, source FROM report_metrics WHERE report_id = ? ORDER BY confidence DESC LIMIT 8'
    ).all(report.id);
    metricCount = db.prepare('SELECT COUNT(*) as c FROM report_metrics WHERE report_id = ?').get(report.id)?.c || 0;
    metricsPreview = metrics;
  }

  res.json({
    id: report.id,
    status: report.status,
    analyzedAt: report.analyzed_at,
    documentType: meta.documentType || report.type || null,
    classificationConfidence: meta.classificationConfidence || null,
    pipeline: meta.pipeline || null,
    ocrConfidence: meta.ocrConfidence || null,
    ocrSuccess: meta.ocrSuccess ?? null,
    visionSuccess: meta.visionSuccess ?? null,
    textSnippet: meta.textSnippet || null,
    medicinesDetected: meta.medicinesDetected || [],
    metricCount,
    metricsPreview,
    errorReason: meta.errorReason || null,
    partialSuccess: meta.partialSuccess || false,
    completedSteps: meta.completedSteps || [],
    ocrStatus: meta.ocrStatus || null,
    metricExtractionStatus: meta.metricExtractionStatus || null,
    clinicalRulesStatus: meta.clinicalRulesStatus || null,
    geminiStatus: meta.geminiStatus || null,
    aiFallback: meta.aiFallback || false,
  });
});

// DELETE /api/reports/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM report_metrics WHERE report_id = ?').run(req.params.id);
    db.prepare('DELETE FROM ai_insights WHERE report_id = ?').run(req.params.id);
    db.prepare('DELETE FROM vitals_timeline WHERE report_id = ?').run(req.params.id);
    db.prepare('DELETE FROM health_events WHERE report_id = ?').run(req.params.id);
    db.prepare('DELETE FROM reports WHERE id = ?').run(req.params.id);
    
    await rebuildHealthScores(db, 'default-user');
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/compare
router.get('/compare', (req, res) => {
  try {
    const db = getDb();
    
    let latestReport, previousReport;

    if (req.query.baseReportId && req.query.compareReportId) {
      latestReport = db.prepare('SELECT id, name, uploaded_at FROM reports WHERE id = ?').get(req.query.compareReportId);
      previousReport = db.prepare('SELECT id, name, uploaded_at FROM reports WHERE id = ?').get(req.query.baseReportId);
    } else {
      const reports = db.prepare(`
        SELECT id, name, uploaded_at 
        FROM reports 
        WHERE user_id = 'default-user' AND status = 'analyzed'
        ORDER BY uploaded_at DESC
      `).all();

      if (reports.length < 2) {
        return res.json({ latestReport: null, previousReport: null, comparisons: [] });
      }
      latestReport = reports[0];
      previousReport = reports[1];
    }

    if (!latestReport || !previousReport) {
      return res.json({ latestReport: null, previousReport: null, comparisons: [] });
    }

    const latestMetrics = db.prepare('SELECT * FROM report_metrics WHERE report_id = ?').all(latestReport.id);
    const previousMetrics = db.prepare('SELECT * FROM report_metrics WHERE report_id = ?').all(previousReport.id);

    const prevMap = {};
    for (const m of previousMetrics) {
      prevMap[m.metric_name.toLowerCase()] = m;
    }

    const comparisonList = [];

    for (const curr of latestMetrics) {
      const prev = prevMap[curr.metric_name.toLowerCase()];
      if (prev && typeof curr.value === 'number' && typeof prev.value === 'number') {
        const diff = curr.value - prev.value;
        const pct = prev.value !== 0 ? Math.round((diff / prev.value) * 100) : 0;
        
        let direction = 'stable';
        let status = 'stable';
        
        const normName = curr.metric_name.toLowerCase();
        
        // Define direction
        if (diff > 0.01) direction = 'up';
        else if (diff < -0.01) direction = 'down';

        // Check improvements vs. declines
        if (normName.includes('vitamin') || normName.includes('hdl') || normName.includes('hemoglobin') || normName.includes('calcium')) {
          // Higher is generally better for these
          if (direction === 'up') status = 'improved';
          else if (direction === 'down') status = 'declining';
        } else {
          // Lower is generally better for glucose, LDL, cholesterol, BP, triglycerides
          if (direction === 'down') status = 'improved';
          else if (direction === 'up') status = 'declining';
        }

        comparisonList.push({
          metric: curr.metric_name,
          currentValue: curr.value,
          previousValue: prev.value,
          unit: curr.unit,
          diff: parseFloat(diff.toFixed(2)),
          percentage: pct,
          direction,
          status,
        });
      }
    }

    res.json({
      latestReport: { id: latestReport.id, name: latestReport.name, date: formatDate(latestReport.uploaded_at) },
      previousReport: { id: previousReport.id, name: previousReport.name, date: formatDate(previousReport.uploaded_at) },
      comparisons: comparisonList
    });

  } catch (err) {
    console.error('Comparison error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function getDemoComparison() {
  return {
    latestReport: { name: 'Complete Blood Count', date: '12 Jun 2026' },
    previousReport: { name: 'Complete Blood Count', date: '12 Mar 2026' },
    comparisons: [
      { metric: 'Vitamin D', currentValue: 18, previousValue: 32, unit: 'ng/mL', diff: -14, percentage: -44, direction: 'down', status: 'declining' },
      { metric: 'Hemoglobin', currentValue: 13.1, previousValue: 11.8, unit: 'g/dL', diff: 1.3, percentage: 11, direction: 'up', status: 'improved' },
      { metric: 'LDL Cholesterol', currentValue: 142, previousValue: 145, unit: 'mg/dL', diff: -3, percentage: -2, direction: 'down', status: 'improved' },
      { metric: 'Fasting Glucose', currentValue: 89, previousValue: 92, unit: 'mg/dL', diff: -3, percentage: -3, direction: 'down', status: 'improved' },
    ]
  };
}

function formatDate(iso) {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

module.exports = router;
