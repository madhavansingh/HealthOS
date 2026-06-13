const { getDb } = require('../connection');
const { v4: uuidv4 } = require('uuid');

class PreventiveRepository {
  static findByUserId(userId) {
    const db = getDb();
    return db.prepare('SELECT * FROM preventive_care WHERE user_id = ? ORDER BY priority, due').all(userId);
  }

  static addPreventiveCare(item) {
    const db = getDb();
    const id = item.id || uuidv4();
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
