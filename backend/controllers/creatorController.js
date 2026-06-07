const { pool } = require('../config/database');

// Получить квизы текущего пользователя
exports.getMyQuizzes = async (req, res) => {
  try {
    const [quizzes] = await pool.query(
      'SELECT * FROM quizzes WHERE author_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(quizzes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Создать квиз
exports.createQuiz = async (req, res) => {
  try {
    const { title, description, quiz_type, difficulty, time_limit, category_id } = req.body;

    let questions = req.body.questions;
    if (typeof questions === 'string') {
      try { questions = JSON.parse(questions); } catch(e) { questions = []; }
    }

    const cover_image = req.file ? `/uploads/${req.file.filename}` : null;
    const uuid = require('uuid').v4();

    if (!title) return res.status(400).json({ message: 'Название обязательно' });
    if (!Array.isArray(questions) || questions.length === 0)
      return res.status(400).json({ message: 'Добавьте хотя бы один вопрос' });

    const [result] = await pool.query(
      `INSERT INTO quizzes (uuid, title, description, cover_image, quiz_type, difficulty, time_limit,
        category_id, author_id, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [uuid, title, description || null, cover_image, quiz_type || 'classic',
       difficulty || 'medium', time_limit || null, category_id || null, req.user.id]
    );

    const quizId = result.insertId;

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const [qResult] = await pool.query(
        `INSERT INTO questions (quiz_id, text, question_type, explanation, time_limit, points, order_num)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [quizId, q.text, q.question_type || 'single', q.explanation || null,
         q.time_limit || null, q.points || 1, idx]
      );
      const questionId = qResult.insertId;
      for (const a of (q.answers || [])) {
        await pool.query(
          'INSERT INTO answers (question_id, text, is_correct) VALUES (?, ?, ?)',
          [questionId, a.text, a.is_correct ? 1 : 0]
        );
      }
    }

    res.status(201).json({ message: 'Квиз создан и опубликован' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Получить квиз для редактирования
exports.getQuizForEdit = async (req, res) => {
  try {
    const [quizzes] = await pool.query(
      'SELECT * FROM quizzes WHERE id = ? AND author_id = ?',
      [req.params.id, req.user.id]
    );
    if (quizzes.length === 0) return res.status(404).json({ error: 'Не найден' });
    
    const [questions] = await pool.query(
      'SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_num',
      [req.params.id]
    );
    for (const q of questions) {
      const [answers] = await pool.query(
        'SELECT id, text, is_correct FROM answers WHERE question_id = ? ORDER BY id',
        [q.id]
      );
      q.answers = answers;
    }
    
    res.json({ ...quizzes[0], questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Обновить квиз
exports.updateQuiz = async (req, res) => {
  try {
    const { title, description, quiz_type, time_limit, questions } = req.body;
    
    await pool.query(
      'UPDATE quizzes SET title = ?, description = ?, quiz_type = ?, time_limit = ? WHERE id = ? AND author_id = ?',
      [title, description, quiz_type, time_limit, req.params.id, req.user.id]
    );
    
    await pool.query('DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE quiz_id = ?)', [req.params.id]);
    await pool.query('DELETE FROM questions WHERE quiz_id = ?', [req.params.id]);
    
    for (const q of questions) {
      const [qResult] = await pool.query(
        'INSERT INTO questions (quiz_id, text, correct_index) VALUES (?, ?, ?)',
        [req.params.id, q.text, q.correct]
      );
      const questionId = qResult.insertId;
      for (let i = 0; i < q.options.length; i++) {
        await pool.query(
          'INSERT INTO options (question_id, option_text, option_index) VALUES (?, ?, ?)',
          [questionId, q.options[i], i]
        );
      }
    }
    
    res.json({ message: 'Квиз обновлён' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Удалить квиз
exports.deleteQuiz = async (req, res) => {
  try {
    await pool.query('DELETE FROM quizzes WHERE id = ? AND author_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Удалён' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
