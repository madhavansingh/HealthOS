const { getDb } = require('../connection');
const { v4: uuidv4 } = require('uuid');

class EventRepository {
  static findByUserId(userId, limit = 20) {
    const db = getDb();
    return db.prepare(`
      SELECT e.* FROM health_events e
      LEFT JOIN reports r ON r.id = e.report_id
      WHERE e.user_id = ? AND (r.id IS NULL OR r.status IN ('analyzed', 'partial'))
      ORDER BY e.date DESC
      LIMIT ?
    `).all(userId, limit);
  }

  static addEvent(event) {
    const db = getDb();
    const id = event.id || uuidv4();
    db.prepare(`
      INSERT INTO health_events (id, user_id, report_id, date, type, title, detail, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      event.user_id || 'default-user',
      event.report_id || null,
      event.date,
      event.type,
      event.title,
      event.detail || null,
      event.color || '#6366f1'
    );
  }

  static deleteEventsByReportId(reportId) {
    const db = getDb();
    db.prepare('DELETE FROM health_events WHERE report_id = ?').run(reportId);
  }
}

module.exports = EventRepository;
