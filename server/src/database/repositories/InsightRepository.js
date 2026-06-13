const { getDb } = require('../connection');
const { v4: uuidv4 } = require('uuid');

class InsightRepository {
  static getInsightsByUserId(userId, limit = 20) {
    const db = getDb();
    return db.prepare(`
      SELECT i.*, r.name as report_name, r.uploaded_at
      FROM ai_insights i
      JOIN reports r ON r.id = i.report_id
      WHERE i.user_id = ? AND r.status IN ('analyzed', 'partial')
      ORDER BY i.created_at DESC
      LIMIT ?
    `).all(userId, limit);
  }

  static addInsight(insight) {
    const db = getDb();
    const id = insight.id || uuidv4();
    db.prepare(`
      INSERT INTO ai_insights (id, report_id, user_id, category, severity, title, description, metric, icon, sources)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      insight.report_id || null,
      insight.user_id || 'default-user',
      insight.category,
      insight.severity || 'info',
      insight.title,
      insight.description,
      insight.metric || null,
      insight.icon || 'activity',
      insight.sources ? (typeof insight.sources === 'string' ? insight.sources : JSON.stringify(insight.sources)) : '[]'
    );
  }

  static deleteInsightsByReportId(reportId) {
    const db = getDb();
    db.prepare('DELETE FROM ai_insights WHERE report_id = ?').run(reportId);
  }
}

module.exports = InsightRepository;
