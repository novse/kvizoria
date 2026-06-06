const pool = require('../config/db');

exports.getAdminStats = async (req, res) => {
  try {
    const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM users');
    const [totalQuizzes] = await db.query('SELECT COUNT(*) as count FROM quizzes');
    const [totalAttempts] = await db.query('SELECT COUNT(*) as count FROM quiz_results');
    const [avgScore] = await db.query('SELECT AVG(score) as avg FROM quiz_results');

    const [popularQuizzes] = await db.query(`
      SELECT q.title, COUNT(qr.id) as attempts
      FROM quizzes q
      LEFT JOIN quiz_results qr ON q.id = qr.quiz_id
      GROUP BY q.id
      ORDER BY attempts DESC
      LIMIT 5
    `);

    res.json({
      totalUsers: totalUsers[0].count,
      totalQuizzes: totalQuizzes[0].count,
      totalAttempts: totalAttempts[0].count,
      avgScore: avgScore[0].avg || 0,
      popularQuizzes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
