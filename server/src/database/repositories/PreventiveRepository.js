const { getDb } = require('../connection');
const { randomUUID } = require('crypto');

class PreventiveRepository {
  static findByUserId(userId) {
    const db = getDb();
    return db.prepare('SELECT * FROM preventive_care WHERE user_id = ? ORDER BY priority, due').all(userId);
  }

  static addPreventiveCare(item) {
    const db = getDb();
    const id = item.id || randomUUID();
    db.prepare(`
      INSERT INTO preventive_care (id, user_id, title, due, priority, reason, specialist, done)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      item.user_id || 'default-user',
      item.title,
      item.due,
      item.priority || 'medium',
      item.reason || null,
      item.specialist || null,
      item.done ?? 0
    );
  }
}

module.exports = PreventiveRepository;
