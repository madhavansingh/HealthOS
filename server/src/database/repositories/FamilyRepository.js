const { getDb } = require('../connection');
const { randomUUID } = require('crypto');

class FamilyRepository {
  static findByUserId(userId) {
    const db = getDb();
    const members = db.prepare('SELECT * FROM family_members WHERE user_id = ?').all(userId);
    return members.map(m => ({
      ...m,
      conditions: JSON.parse(m.conditions || '[]'),
    }));
  }

  static addMember(member) {
    const db = getDb();
    const id = member.id || randomUUID();
    db.prepare(`
      INSERT INTO family_members (id, user_id, name, relation, age, score, conditions, last_checkup)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      member.user_id || 'default-user',
      member.name,
      member.relation,
      member.age,
      member.score ?? 75,
      member.conditions ? (typeof member.conditions === 'string' ? member.conditions : JSON.stringify(member.conditions)) : '[]',
      member.last_checkup || null
    );
  }
}

module.exports = FamilyRepository;
