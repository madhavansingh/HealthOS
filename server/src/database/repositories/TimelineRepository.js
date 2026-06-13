const { getDb } = require('../connection');
const { randomUUID } = require('crypto');

class TimelineRepository {
  // --- Vitals Timeline ---
  static getTimelineVitals(userId) {
    const db = getDb();
    return db.prepare('SELECT * FROM vitals_timeline WHERE user_id = ? ORDER BY date').all(userId);
  }

  static addVital(vital) {
    const db = getDb();
    const id = vital.id || randomUUID();
    db.prepare(`
      INSERT INTO vitals_timeline (id, user_id, report_id, date, metric_name, value, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      vital.user_id || 'default-user',
      vital.report_id || null,
      vital.date,
      vital.metric_name,
      vital.value,
      vital.unit || ''
    );
  }

  static deleteVitalsByReportId(reportId) {
    const db = getDb();
    db.prepare('DELETE FROM vitals_timeline WHERE report_id = ?').run(reportId);
  }

  // --- Health Scores ---
  static getHealthScores(userId) {
    const db = getDb();
    return db.prepare('SELECT * FROM health_scores WHERE user_id = ? ORDER BY date').all(userId);
  }

  static getLatestScore(userId) {
    const db = getDb();
    return db.prepare('SELECT * FROM health_scores WHERE user_id = ? ORDER BY date DESC LIMIT 1').get(userId);
  }

  static getPreviousScore(userId) {
    const db = getDb();
    return db.prepare('SELECT * FROM health_scores WHERE user_id = ? ORDER BY date DESC LIMIT 1 OFFSET 1').get(userId);
  }

  static addHealthScore(score) {
    const db = getDb();
    const id = score.id || randomUUID();
    db.prepare(`
      INSERT INTO health_scores (id, user_id, date, overall, cardiovascular, metabolic, sleep, activity, mental, nutrition)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      score.user_id || 'default-user',
      score.date,
      score.overall,
      score.cardiovascular,
      score.metabolic,
      score.sleep,
      score.activity,
      score.mental,
      score.nutrition
    );
  }

  static deleteScoresByUserId(userId) {
    const db = getDb();
    db.prepare('DELETE FROM health_scores WHERE user_id = ?').run(userId);
  }
}

module.exports = TimelineRepository;
