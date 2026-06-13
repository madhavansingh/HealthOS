const { getDb } = require('../connection');
const { v4: uuidv4 } = require('uuid');

class ReportRepository {
  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  }

  static findByUserId(userId) {
    const db = getDb();
    return db.prepare(`
      SELECT r.*,
        COUNT(DISTINCT m.id) as metric_count,
        COUNT(DISTINCT i.id) as insight_count,
        COUNT(CASE WHEN m.status != 'normal' THEN 1 END) as abnormal_count
      FROM reports r
      LEFT JOIN report_metrics m ON m.report_id = r.id
      LEFT JOIN ai_insights i ON i.report_id = r.id
      WHERE r.user_id = ?
      GROUP BY r.id
      ORDER BY r.uploaded_at DESC
    `).all(userId);
  }

  static create(report) {
    const db = getDb();
    db.prepare(`
      INSERT INTO reports (id, user_id, name, type, lab, file_path, file_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      report.id,
      report.user_id || 'default-user',
      report.name,
      report.type || null,
      report.lab || null,
      report.file_path,
      report.file_name,
      report.status || 'processing'
    );
    return this.findById(report.id);
  }

  static delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM reports WHERE id = ?').run(id);
  }

  static updateStatus(id, status) {
    const db = getDb();
    db.prepare('UPDATE reports SET status = ?, analyzed_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
  }

  static updateProcessingMeta(id, meta) {
    const db = getDb();
    db.prepare('UPDATE reports SET processing_meta = ? WHERE id = ?').run(JSON.stringify(meta), id);
  }

  static getProcessingMeta(id) {
    const db = getDb();
    const result = db.prepare('SELECT processing_meta FROM reports WHERE id = ?').get(id);
    if (!result?.processing_meta) return {};
    try {
      return JSON.parse(result.processing_meta);
    } catch (_) {
      return {};
    }
  }

  // --- Metrics ---
  static getMetricsByReportId(reportId) {
    const db = getDb();
    return db.prepare('SELECT * FROM report_metrics WHERE report_id = ? ORDER BY category, metric_name').all(reportId);
  }

  static getRecentMetrics(userId, limit = 40) {
    const db = getDb();
    return db.prepare(`
      SELECT m.metric_name, m.value, m.unit, m.status, m.category, r.uploaded_at
      FROM report_metrics m
      JOIN reports r ON r.id = m.report_id
      WHERE r.user_id = ? AND r.status IN ('analyzed', 'partial')
      ORDER BY r.uploaded_at DESC
      LIMIT ?
    `).all(userId, limit);
  }

  static getAllMetrics(userId) {
    const db = getDb();
    return db.prepare(`
      SELECT m.*, r.uploaded_at as report_date, r.name as report_name, r.id as report_id
      FROM report_metrics m
      JOIN reports r ON r.id = m.report_id
      WHERE r.user_id = ? AND r.status IN ('analyzed', 'partial')
      ORDER BY r.uploaded_at DESC
    `).all(userId);
  }

  static addMetric(metric) {
    const db = getDb();
    const id = metric.id || uuidv4();
    db.prepare(`
      INSERT INTO report_metrics (id, report_id, metric_name, value, value_text, unit, reference_low, reference_high, status, category, confidence, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      metric.report_id,
      metric.metric_name,
      metric.value,
      metric.value_text || null,
      metric.unit || '',
      metric.reference_low ?? null,
      metric.reference_high ?? null,
      metric.status || 'normal',
      metric.category || 'other',
      metric.confidence ?? 1.0,
      metric.source || 'text_pdf'
    );
  }

  static deleteMetricsByReportId(reportId) {
    const db = getDb();
    db.prepare('DELETE FROM report_metrics WHERE report_id = ?').run(reportId);
  }
}

module.exports = ReportRepository;
