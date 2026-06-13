const { getDb } = require('../connection');
const { randomUUID } = require('crypto');

class ChatRepository {
  static getSessionMessages(sessionId, userId = 'default-user') {
    const db = getDb();
    return db.prepare('SELECT * FROM chat_messages WHERE session_id = ? AND user_id = ? ORDER BY created_at ASC').all(sessionId, userId);
  }

  static addMessage(msg) {
    const db = getDb();
    const id = msg.id || randomUUID();
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, user_id, role, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      msg.sessionId,
      msg.userId || 'default-user',
      msg.role,
      msg.content
    );
  }

  static deleteSessionMessages(sessionId) {
    const db = getDb();
    db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
  }
}

module.exports = ChatRepository;
