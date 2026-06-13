const { getDb } = require('../connection');

class UserRepository {
  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  static createOrUpdate(user) {
    const db = getDb();
    const existing = this.findById(user.id);
    if (existing) {
      db.prepare(`
        UPDATE users
        SET name = ?, email = ?, age = ?, gender = ?, blood_type = ?, height = ?, weight = ?, location = ?, primary_doctor = ?, plan = ?
        WHERE id = ?
      `).run(
        user.name, user.email, user.age, user.gender, user.blood_type,
        user.height, user.weight, user.location, user.primary_doctor, user.plan,
        user.id
      );
    } else {
      db.prepare(`
        INSERT INTO users (id, name, email, age, gender, blood_type, height, weight, location, primary_doctor, plan)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.id, user.name, user.email, user.age, user.gender, user.blood_type,
        user.height, user.weight, user.location, user.primary_doctor, user.plan
      );
    }
    return this.findById(user.id);
  }
}

module.exports = UserRepository;
