const { pool } = require('../config/database');

exports.getAdminStats = async (req, res) => {
  try {
    const [[{ count: totalUsers }]] = await pool.query('SELECT COUNT(*) as count FROM users');
    const [[{ count: totalQuizzes }]] = await pool.query('SELECT COUNT(*) as count FROM quizzes WHERE is_published = 1');
    const [[{ count: totalAttempts }]] = await pool.query('SELECT COUNT(*) as count FROM quiz_attempts');
    const [[{ avg: avgScore }]] = await pool.query('SELECT AVG(percent_score) as avg FROM quiz_attempts');

    const [popularQuizzes] = await pool.query(`
      SELECT q.title, COUNT(qa.id) as attempts
      FROM quizzes q
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id
      GROUP BY q.id, q.title
      ORDER BY attempts DESC
      LIMIT 5
    `);

    const [recentAttempts] = await pool.query(`
      SELECT u.username, q.title, qa.percent_score, qa.is_passed, qa.completed_at
      FROM quiz_attempts qa
      JOIN users u ON qa.user_id = u.id
      JOIN quizzes q ON qa.quiz_id = q.id
      ORDER BY qa.completed_at DESC
      LIMIT 10
    `);

    res.json({
      totalUsers,
      totalQuizzes,
      totalAttempts,
      avgScore: Number(avgScore || 0).toFixed(1),
      popularQuizzes,
      recentAttempts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
