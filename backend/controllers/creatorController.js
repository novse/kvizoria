const { pool } = require('../config/database');

// Получить квизы текущего пользователя
exports.getMyQuizzes = async (req, res) => {
  try {
    const [quizzes] = await pool.query(
      'SELECT * FROM quizzes WHERE creator_id = ? ORDER BY created_at DESC',
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
    const { title, description, quiz_type, time_limit, questions } = req.body;
    
    const [result] = await pool.query(
      'INSERT INTO quizzes (title, description, quiz_type, time_limit, creator_id, is_published) VALUES (?, ?, ?, ?, ?, false)',
      [title, description, quiz_type, time_limit, req.user.id]
    );
    
    const quizId = result.insertId;
    
    for (const q of questions) {
      const [qResult] = await pool.query(
        'INSERT INTO questions (quiz_id, text, correct_index) VALUES (?, ?, ?)',
        [quizId, q.text, q.correct]
      );
      
      const questionId = qResult.insertId;
      for (let i = 0; i < q.options.length; i++) {
        await pool.query(
          'INSERT INTO options (question_id, option_text, option_index) VALUES (?, ?, ?)',
          [questionId, q.options[i], i]
        );
      }
    }
    
    res.status(201).json({ id: quizId, message: 'Квиз создан' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Получить квиз для редактирования
exports.getQuizForEdit = async (req, res) => {
  try {
    const [quizzes] = await pool.query(
      'SELECT * FROM quizzes WHERE id = ? AND creator_id = ?',
      [req.params.id, req.user.id]
    );
    if (quizzes.length === 0) return res.status(404).json({ error: 'Не найден' });
    
    const [questions] = await pool.query('SELECT * FROM questions WHERE quiz_id = ?', [req.params.id]);
    for (const q of questions) {
      const [options] = await pool.query('SELECT option_text, option_index FROM options WHERE question_id = ? ORDER BY option_index', [q.id]);
      q.options = options.map(o => o.option_text);
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
      'UPDATE quizzes SET title = ?, description = ?, quiz_type = ?, time_limit = ? WHERE id = ? AND creator_id = ?',
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
    await pool.query('DELETE FROM quizzes WHERE id = ? AND creator_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Удалён' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
