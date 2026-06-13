const express = require('express');
const { getDb } = require('../db/database');

const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('default-user');
    const latestScore = db.prepare('SELECT * FROM health_scores WHERE user_id = ? ORDER BY date DESC LIMIT 1').get('default-user');
    const previousScore = db.prepare('SELECT * FROM health_scores WHERE user_id = ? ORDER BY date DESC LIMIT 1 OFFSET 1').get('default-user');

    const reportCount = db.prepare('SELECT COUNT(*) as c FROM reports WHERE user_id = ?').get('default-user');
    const analyzedCount = db.prepare("SELECT COUNT(*) as c FROM reports WHERE user_id = ? AND status IN ('analyzed', 'partial')").get('default-user');
    const insightCount = db.prepare("SELECT COUNT(*) as c FROM ai_insights i JOIN reports r ON r.id = i.report_id WHERE i.user_id = ? AND r.status IN ('analyzed', 'partial')").get('default-user');
    const recentReports = db.prepare(`
      SELECT r.*, COUNT(DISTINCT m.id) as metric_count,
        COUNT(CASE WHEN m.status != 'normal' THEN 1 END) as abnormal_count,
        COUNT(DISTINCT i.id) as insight_count
      FROM reports r
      LEFT JOIN report_metrics m ON m.report_id = r.id
      LEFT JOIN ai_insights i ON i.report_id = r.id
      WHERE r.user_id = 'default-user'
      GROUP BY r.id
      ORDER BY r.uploaded_at DESC
      LIMIT 5
    `).all();

    const scoreBreakdown = latestScore
      ? {
          cardiovascular: latestScore.cardiovascular,
          metabolic: latestScore.metabolic,
          sleep: latestScore.sleep,
          activity: latestScore.activity,
          mental: latestScore.mental,
          nutrition: latestScore.nutrition,
        }
      : { cardiovascular: 0, metabolic: 0, sleep: 0, activity: 0, mental: 0, nutrition: 0 };

    res.json({
      user: {
        name: user?.name || 'Guest User',
        age: user?.age || null,
        bloodType: user?.blood_type || '',
        plan: user?.plan || 'Basic Plan',
        location: user?.location || '',
        primaryDoctor: user?.primary_doctor || '',
      },
      healthScore: {
        overall: latestScore?.overall || 0,
        previousScore: previousScore?.overall || 0,
        breakdown: scoreBreakdown,
      },
      stats: {
        totalReports: reportCount?.c || 0,
        analyzedReports: analyzedCount?.c || 0,
        totalInsights: insightCount?.c || 0,
        hasData: (reportCount?.c || 0) > 0,
      },
      recentReports: recentReports.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type || 'General',
        date: formatDate(r.uploaded_at),
        status: r.status,
        insights: r.insight_count || 0,
        abnormal: r.abnormal_count || 0,
      })),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

function formatDate(iso) {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

module.exports = router;
