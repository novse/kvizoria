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

// ─── CREATE QUIZ (ADMIN) ─────────────────────────────────────
exports.createQuizAdmin = async (req, res) => {
    try {
        const { title, description, category_id, quiz_type, difficulty, time_limit, max_attempts,
                is_public, shuffle_questions, shuffle_answers, pass_score } = req.body;
        
        // questions может прийти как JSON-строка из FormData
        let questions = req.body.questions;
        if (typeof questions === 'string') {
            try { questions = JSON.parse(questions); } catch(e) { questions = []; }
        }
        
        const cover_image = req.file ? `/uploads/${req.file.filename}` : null;
        const uuid = require('uuid').v4();
        
        const [result] = await pool.query(`
            INSERT INTO quizzes (uuid, title, description, cover_image, category_id, author_id,
                quiz_type, difficulty, time_limit, max_attempts, is_public, shuffle_questions,
                shuffle_answers, pass_score, is_published)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [uuid, title, description, cover_image, category_id || null, req.user.id,
            quiz_type || 'classic', difficulty || 'medium', time_limit || null,
            max_attempts || 3, is_public !== false ? 1 : 0,
            shuffle_questions !== false ? 1 : 0, shuffle_answers !== false ? 1 : 0, pass_score || 60]);

        const quizId = result.insertId;

        if (questions && Array.isArray(questions)) {
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                const [qRes] = await pool.query(
                    'INSERT INTO questions (quiz_id, text, question_type, explanation, points, order_num) VALUES (?, ?, ?, ?, ?, ?)',
                    [quizId, q.text, q.type || 'single', q.explanation || null, q.points || 1, i]
                );
                if (q.answers) {
                    for (const a of q.answers) {
                        await pool.query(
                            'INSERT INTO answers (question_id, text, is_correct) VALUES (?, ?, ?)',
                            [qRes.insertId, a.text, a.is_correct ? 1 : 0]
                        );
                    }
                }
            }
        }
        res.status(201).json({ id: quizId, uuid, message: 'Квиз создан' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// ─── GET QUIZ FOR EDIT (ADMIN) ───────────────────────────────
exports.getQuizForEdit = async (req, res) => {
    try {
        const { id } = req.params;
        const [[quiz]] = await pool.query(`SELECT * FROM quizzes WHERE id = ?`, [id]);
        if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
        
        const [questions] = await pool.query(
            'SELECT id, text, image, question_type, explanation, points, time_limit, order_num FROM questions WHERE quiz_id = ? ORDER BY order_num',
            [quiz.id]
        );
        for (const q of questions) {
            const [answers] = await pool.query(
                'SELECT id, text, is_correct FROM answers WHERE question_id = ? ORDER BY id',
                [q.id]
            );
            q.answers = answers;
        }
        quiz.questions = questions;
        res.json(quiz);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// ─── UPDATE QUIZ (ADMIN) ─────────────────────────────────────
exports.updateQuiz = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category_id, quiz_type, difficulty, time_limit, max_attempts,
                is_public, shuffle_questions, shuffle_answers, pass_score, questions } = req.body;
        
        await pool.query(`
            UPDATE quizzes 
            SET title = ?, description = ?, category_id = ?, quiz_type = ?, difficulty = ?,
                time_limit = ?, max_attempts = ?, is_public = ?, shuffle_questions = ?,
                shuffle_answers = ?, pass_score = ?
            WHERE id = ?
        `, [title, description, category_id, quiz_type, difficulty, time_limit, max_attempts,
            is_public !== false ? 1 : 0, shuffle_questions !== false ? 1 : 0,
            shuffle_answers !== false ? 1 : 0, pass_score || 60, id]);
        
        // Удаляем старые вопросы и ответы
        await pool.query('DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE quiz_id = ?)', [id]);
        await pool.query('DELETE FROM questions WHERE quiz_id = ?', [id]);
        
        if (questions && Array.isArray(questions)) {
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                const [qRes] = await pool.query(
                    'INSERT INTO questions (quiz_id, text, question_type, explanation, points, order_num) VALUES (?, ?, ?, ?, ?, ?)',
                    [id, q.text, q.type || 'single', q.explanation || null, q.points || 1, i]
                );
                if (q.answers) {
                    for (const a of q.answers) {
                        await pool.query(
                            'INSERT INTO answers (question_id, text, is_correct) VALUES (?, ?, ?)',
                            [qRes.insertId, a.text, a.is_correct ? 1 : 0]
                        );
                    }
                }
            }
        }
        
        res.json({ message: 'Квиз обновлён' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
