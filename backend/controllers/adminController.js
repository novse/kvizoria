const { pool } = require('../config/database');

exports.getDashboard = async (req, res) => {
  try {
    const [[users]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const [[quizzes]] = await pool.query('SELECT COUNT(*) AS count FROM quizzes WHERE is_published = 1');
    const [[attempts]] = await pool.query('SELECT COUNT(*) AS count FROM quiz_attempts');
    const [[violations]] = await pool.query('SELECT COUNT(*) AS count FROM violations_log');
    const [recentUsers] = await pool.query(
      'SELECT id, username, email, role, created_at, is_blocked FROM users ORDER BY created_at DESC LIMIT 5'
    );
    const [topQuizzes] = await pool.query(
      'SELECT uuid, title, plays_count, quiz_type FROM quizzes WHERE is_published=1 ORDER BY plays_count DESC LIMIT 5'
    );
    res.json({ stats: { users: users.count, quizzes: quizzes.count, attempts: attempts.count, violations: violations.count }, recentUsers, topQuizzes });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка дашборда', error: err.message });
  }
};

exports.getUsers = async (req, res) => {
  const [users] = await pool.query(
    'SELECT id, uuid, username, email, role, is_blocked, created_at FROM users ORDER BY created_at DESC'
  );
  res.json(users);
};

exports.updateUser = async (req, res) => {
  const { role, is_blocked } = req.body;
  const fields = [], vals = [];
  if (role) { fields.push('role = ?'); vals.push(role); }
  if (is_blocked !== undefined) { fields.push('is_blocked = ?'); vals.push(is_blocked ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ message: 'Нечего обновлять' });
  vals.push(req.params.id);
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
  res.json({ message: 'Пользователь обновлён' });
};

exports.getAllQuizzes = async (req, res) => {
  const [quizzes] = await pool.query(`
    SELECT q.id, q.uuid, q.title, q.is_published, q.is_public, q.quiz_type,
           q.plays_count, q.created_at, u.username AS author
    FROM quizzes q JOIN users u ON q.author_id = u.id ORDER BY q.created_at DESC
  `);
  res.json(quizzes);
};

exports.togglePublish = async (req, res) => {
  const [[q]] = await pool.query('SELECT id, is_published FROM quizzes WHERE id = ?', [req.params.id]);
  if (!q) return res.status(404).json({ message: 'Не найден' });
  await pool.query('UPDATE quizzes SET is_published = ? WHERE id = ?', [q.is_published ? 0 : 1, q.id]);
  res.json({ message: q.is_published ? 'Снят с публикации' : 'Опубликован' });
};

exports.deleteQuiz = async (req, res) => {
  await pool.query('DELETE FROM quizzes WHERE id = ?', [req.params.id]);
  res.json({ message: 'Квиз удалён' });
};

exports.getViolations = async (req, res) => {
  const [rows] = await pool.query(`
    SELECT v.*, u.username, q.title AS quiz_title
    FROM violations_log v
    JOIN users u ON v.user_id = u.id
    JOIN quizzes q ON v.quiz_id = q.id
    ORDER BY v.created_at DESC LIMIT 100
  `);
  res.json(rows);
};

exports.getCategories = async (req, res) => {
  const [cats] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json(cats);
};

exports.createCategory = async (req, res) => {
  const { name, slug, icon, color } = req.body;
  await pool.query('INSERT INTO categories (name, slug, icon, color) VALUES (?, ?, ?, ?)',
    [name, slug, icon || '🎯', color || '#7C3AED']);
  res.status(201).json({ message: 'Категория создана' });
};

exports.deleteCategory = async (req, res) => {
  await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
  res.json({ message: 'Категория удалена' });
};

// Создание квиза (админ)
exports.createQuizAdmin = async (req, res) => {
    try {
        const { title, description, questions, category_id, quiz_type, time_limit } = req.body;
        const uuid = require('uuid').v4();
        
        const [result] = await db.query(
            `INSERT INTO quizzes (uuid, title, description, questions, category_id, quiz_type, time_limit, created_by, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
            [uuid, title, description, JSON.stringify(questions), category_id, quiz_type, time_limit, req.user.id]
        );
        
        res.status(201).json({ id: result.insertId, uuid, message: 'Квиз создан' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Получение квиза для редактирования
exports.getQuizForEdit = async (req, res) => {
    try {
        const { id } = req.params;
        const [quizzes] = await db.query(`SELECT * FROM quizzes WHERE id = ?`, [id]);
        
        if (quizzes.length === 0) {
            return res.status(404).json({ error: 'Квиз не найден' });
        }
        
        const quiz = quizzes[0];
        if (quiz.questions) {
            quiz.questions = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;
        }
        
        res.json(quiz);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Обновление квиза
exports.updateQuiz = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, questions, category_id, quiz_type, time_limit } = req.body;
        
        await db.query(
            `UPDATE quizzes 
             SET title = ?, description = ?, questions = ?, category_id = ?, quiz_type = ?, time_limit = ?, updated_at = NOW()
             WHERE id = ?`,
            [title, description, JSON.stringify(questions), category_id, quiz_type, time_limit, id]
        );
        
        res.json({ message: 'Квиз обновлён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
