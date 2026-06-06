const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ─── GET ALL QUIZZES (public feed) ───────────────────────────
exports.getQuizzes = async (req, res) => {
  try {
    const { category, search, type, difficulty, page = 1, limit = 12 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = ['q.is_published = 1', 'q.is_public = 1'];
    const params = [];
    if (category) { where.push('c.slug = ?'); params.push(category); }
    if (search) { where.push('(q.title LIKE ? OR q.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (type) { where.push('q.quiz_type = ?'); params.push(type); }
    if (difficulty) { where.push('q.difficulty = ?'); params.push(difficulty); }

    const [quizzes] = await pool.query(`
      SELECT q.id, q.uuid, q.title, q.description, q.cover_image, q.quiz_type,
             q.difficulty, q.time_limit, q.plays_count, q.created_at,
             c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
             u.username AS author_name, u.avatar AS author_avatar,
             (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS questions_count
      FROM quizzes q
      LEFT JOIN categories c ON q.category_id = c.id
      LEFT JOIN users u ON q.author_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY q.plays_count DESC, q.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM quizzes q LEFT JOIN categories c ON q.category_id = c.id WHERE ${where.join(' AND ')}`,
      params
    );

    res.json({ quizzes, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка загрузки квизов', error: err.message });
  }
};

// ─── GET SINGLE QUIZ ─────────────────────────────────────────
exports.getQuiz = async (req, res) => {
  try {
    const [[quiz]] = await pool.query(`
      SELECT q.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
             u.username AS author_name, u.avatar AS author_avatar, u.bio AS author_bio
      FROM quizzes q
      LEFT JOIN categories c ON q.category_id = c.id
      LEFT JOIN users u ON q.author_id = u.id
      WHERE q.uuid = ? AND q.is_published = 1
    `, [req.params.uuid]);
    if (!quiz) return res.status(404).json({ message: 'Квиз не найден' });

    const [questions] = await pool.query(`
      SELECT q.id, q.text, q.image, q.question_type, q.points, q.time_limit, q.order_num
      FROM questions q WHERE q.quiz_id = ? ORDER BY q.order_num, q.id
    `, [quiz.id]);

    for (const q of questions) {
      const [answers] = await pool.query(
        'SELECT id, text, order_num FROM answers WHERE question_id = ? ORDER BY order_num, id',
        [q.id]
      );
      q.answers = answers;
    }
    quiz.questions = questions;
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка загрузки квиза', error: err.message });
  }
};

// ─── CREATE QUIZ ─────────────────────────────────────────────
exports.createQuiz = async (req, res) => {
  try {
    const { title, description, category_id, quiz_type, difficulty, time_limit, max_attempts,
            is_public, shuffle_questions, shuffle_answers, pass_score } = req.body;
    
    let questions = req.body.questions;
    if (typeof questions === 'string') {
      try { questions = JSON.parse(questions); } catch(e) { questions = []; }
    }
    
    const cover_image = req.file ? `/uploads/${req.file.filename}` : null;

    const uuid = uuidv4();
    const [result] = await pool.query(`
      INSERT INTO quizzes (uuid, title, description, cover_image, category_id, author_id,
        quiz_type, difficulty, time_limit, max_attempts, is_public, shuffle_questions,
        shuffle_answers, pass_score, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
    res.status(201).json({ uuid, message: 'Квиз создан' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка создания квиза', error: err.message });
  }
};

// ─── PUBLISH QUIZ ─────────────────────────────────────────────
exports.publishQuiz = async (req, res) => {
  try {
    const [[quiz]] = await pool.query('SELECT id, author_id FROM quizzes WHERE uuid = ?', [req.params.uuid]);
    if (!quiz) return res.status(404).json({ message: 'Квиз не найден' });
    if (quiz.author_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Нет прав' });
    await pool.query('UPDATE quizzes SET is_published = 1 WHERE id = ?', [quiz.id]);
    res.json({ message: 'Квиз опубликован' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка публикации' });
  }
};

// ─── SUBMIT ATTEMPT ──────────────────────────────────────────
exports.submitAttempt = async (req, res) => {
  try {
    const { answers, time_spent, violations } = req.body;
    const [[quiz]] = await pool.query(
      'SELECT id, max_attempts, pass_score FROM quizzes WHERE uuid = ?', [req.params.uuid]
    );
    if (!quiz) return res.status(404).json({ message: 'Квиз не найден' });

    // Проверяем лимит попыток
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM quiz_attempts WHERE quiz_id = ? AND user_id = ?',
      [quiz.id, req.user.id]
    );
    if (cnt >= quiz.max_attempts)
      return res.status(400).json({ message: `Исчерпан лимит попыток (${quiz.max_attempts})` });

    const [questions] = await pool.query(
      'SELECT q.id, q.points FROM questions q WHERE q.quiz_id = ?', [quiz.id]
    );
    const [correctAnswers] = await pool.query(
      'SELECT id, question_id FROM answers WHERE question_id IN (?) AND is_correct = 1',
      [questions.map(q => q.id)]
    );

    let score = 0;
    const maxScore = questions.reduce((s, q) => s + q.points, 0);
    const correctMap = {};
    correctAnswers.forEach(a => { correctMap[a.question_id] = a.id; });

    const attemptUuid = uuidv4();
    const answersData = answers || {};

    for (const q of questions) {
      const userAnswer = answersData[q.id];
      const isCorrect = correctMap[q.id] && userAnswer == correctMap[q.id] ? 1 : 0;
      if (isCorrect) score += q.points;
    }

    const percent = maxScore > 0 ? Math.round((score / maxScore) * 100 * 100) / 100 : 0;
    const isPassed = percent >= quiz.pass_score ? 1 : 0;
    const violationsCount = violations ? violations.length : 0;

    const [attemptRes] = await pool.query(`
      INSERT INTO quiz_attempts (uuid, quiz_id, user_id, score, max_score, percent_score, time_spent, is_passed, violations_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [attemptUuid, quiz.id, req.user.id, score, maxScore, percent, time_spent || 0, isPassed, violationsCount]);

    // Сохраняем ответы
    for (const q of questions) {
      const userAnswer = answersData[q.id];
      if (userAnswer) {
        const isCorrect = correctMap[q.id] && userAnswer == correctMap[q.id] ? 1 : 0;
        await pool.query(
          'INSERT INTO attempt_answers (attempt_id, question_id, answer_id, is_correct) VALUES (?, ?, ?, ?)',
          [attemptRes.insertId, q.id, userAnswer, isCorrect]
        );
      }
    }

    // Логируем нарушения
    if (violations && violations.length > 0) {
      for (const v of violations) {
        await pool.query(
          'INSERT INTO violations_log (attempt_id, user_id, quiz_id, violation_type, description) VALUES (?, ?, ?, ?, ?)',
          [attemptRes.insertId, req.user.id, quiz.id, v.type, v.description || null]
        );
      }
    }

    // Обновляем лидерборд
    await pool.query(`
      INSERT INTO leaderboard (quiz_id, user_id, best_score, best_percent, best_time, attempts_count)
      VALUES (?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        best_score = IF(VALUES(best_score) > best_score, VALUES(best_score), best_score),
        best_percent = IF(VALUES(best_percent) > best_percent, VALUES(best_percent), best_percent),
        best_time = IF(VALUES(best_time) < best_time OR best_time = 0, VALUES(best_time), best_time),
        attempts_count = attempts_count + 1
    `, [quiz.id, req.user.id, score, percent, time_spent || 0]);

    // Обновляем счётчик
    await pool.query('UPDATE quizzes SET plays_count = plays_count + 1 WHERE id = ?', [quiz.id]);

    // Получаем правильные ответы для результатов
    const [allAnswers] = await pool.query(`
      SELECT a.id, a.question_id, a.text, a.is_correct,
             q.text AS question_text, q.explanation
      FROM answers a JOIN questions q ON a.question_id = q.id
      WHERE q.quiz_id = ?
    `, [quiz.id]);

    res.json({
      score, maxScore, percent, isPassed,
      attemptUuid,
      answers: allAnswers,
      violationsCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка отправки ответов', error: err.message });
  }
};

// ─── LEADERBOARD ─────────────────────────────────────────────
exports.getLeaderboard = async (req, res) => {
  try {
    const [[quiz]] = await pool.query('SELECT id FROM quizzes WHERE uuid = ?', [req.params.uuid]);
    if (!quiz) return res.status(404).json({ message: 'Квиз не найден' });
    const [rows] = await pool.query(`
      SELECT l.best_score, l.best_percent, l.best_time, l.attempts_count,
             u.username, u.avatar
      FROM leaderboard l JOIN users u ON l.user_id = u.id
      WHERE l.quiz_id = ?
      ORDER BY l.best_percent DESC, l.best_time ASC
      LIMIT 20
    `, [quiz.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка лидерборда' });
  }
};

// ─── CATEGORIES ──────────────────────────────────────────────
exports.getCategories = async (req, res) => {
  const [cats] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json(cats);
};

// ─── USER HISTORY ────────────────────────────────────────────
exports.getUserHistory = async (req, res) => {
  const [rows] = await pool.query(`
    SELECT a.uuid, a.score, a.max_score, a.percent_score, a.is_passed, a.time_spent,
           a.completed_at, q.title, q.uuid AS quiz_uuid, q.cover_image, q.quiz_type
    FROM quiz_attempts a JOIN quizzes q ON a.quiz_id = q.id
    WHERE a.user_id = ? ORDER BY a.completed_at DESC LIMIT 20
  `, [req.user.id]);
  res.json(rows);
};
// ─── CHECK ATTEMPTS LIMIT ─────────────────────────────────────
exports.checkAttemptsLimit = async (req, res) => {
  try {
    const { uuid } = req.params;
    
    const [[quiz]] = await pool.query(
      'SELECT id, max_attempts FROM quizzes WHERE uuid = ?',
      [uuid]
    );
    
    if (!quiz) {
      return res.status(404).json({ message: 'Квиз не найден' });
    }
    
    const [[attempts]] = await pool.query(
      'SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = ? AND user_id = ?',
      [quiz.id, req.user.id]
    );
    
    const remaining = Math.max(0, quiz.max_attempts - attempts.count);
    
    res.json({
      allowed: attempts.count < quiz.max_attempts,
      attemptsLeft: remaining,
      maxAttempts: quiz.max_attempts,
      usedAttempts: attempts.count,
      message: remaining === 0 ? 'Лимит попыток исчерпан' : `Осталось попыток: ${remaining}`
    });
  } catch (err) {
    console.error('Check attempts error:', err);
    res.status(500).json({ message: err.message });
  }
};
