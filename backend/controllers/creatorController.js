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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
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

    res.status(201).json({ message: 'Квиз создан' });
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
    const { title, description, quiz_type, difficulty, time_limit, category_id } = req.body;

    if (!title) return res.status(400).json({ message: 'Название обязательно' });

    let questions = req.body.questions;
    if (typeof questions === 'string') {
      try { questions = JSON.parse(questions); } catch (e) { questions = []; }
    }
    if (!Array.isArray(questions) || questions.length === 0)
      return res.status(400).json({ message: 'Добавьте хотя бы один вопрос' });

    const [[quiz]] = await pool.query(
      'SELECT id FROM quizzes WHERE id = ? AND author_id = ?',
      [req.params.id, req.user.id]
    );
    if (!quiz) return res.status(404).json({ message: 'Квиз не найден' });

    const cover_image = req.file ? `/uploads/${req.file.filename}` : undefined;

    const updateFields = [
      title,
      description || null,
      quiz_type || 'classic',
      difficulty || 'medium',
      time_limit ? Number(time_limit) : null,
      category_id || null,
    ];

    if (cover_image !== undefined) {
      await pool.query(
        'UPDATE quizzes SET title=?, description=?, quiz_type=?, difficulty=?, time_limit=?, category_id=?, cover_image=? WHERE id=?',
        [...updateFields, cover_image, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE quizzes SET title=?, description=?, quiz_type=?, difficulty=?, time_limit=?, category_id=? WHERE id=?',
        [...updateFields, req.params.id]
      );
    }

    const [oldQuestions] = await pool.query('SELECT id FROM questions WHERE quiz_id = ?', [req.params.id]);
    for (const oq of oldQuestions) {
      await pool.query('DELETE FROM answers WHERE question_id = ?', [oq.id]);
    }
    await pool.query('DELETE FROM questions WHERE quiz_id = ?', [req.params.id]);

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const [qResult] = await pool.query(
        'INSERT INTO questions (quiz_id, text, question_type, explanation, time_limit, points, order_num) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.params.id, q.text, q.question_type || 'single', q.explanation || null,
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

    res.json({ message: 'Квиз обновлён' });
  } catch (err) {
    console.error(err);
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

// Результаты прохождения квизов создателя
exports.getMyResults = async (req, res) => {
  try {
    const { quizId } = req.query;
    let query = `
      SELECT
        qa.id,
        u.username,
        u.email,
        q.id        AS quiz_id,
        q.title     AS quiz_title,
        qa.score,
        qa.max_score,
        qa.percent_score,
        qa.is_passed,
        qa.completed_at,
        (SELECT COUNT(*) FROM violations_log vl
         WHERE vl.user_id = qa.user_id AND vl.quiz_id = qa.quiz_id) AS violations_count
      FROM quiz_attempts qa
      JOIN users   u ON qa.user_id = u.id
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE q.author_id = ?
    `;
    const params = [req.user.id];
    if (quizId) { query += ' AND q.id = ?'; params.push(quizId); }
    query += ' ORDER BY qa.completed_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Экспорт результатов своих квизов в Excel
exports.exportMyResults = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { quizId } = req.query;
    let query = `
      SELECT
        u.username  AS name,
        u.email,
        q.title     AS quiz_title,
        qa.score,
        qa.max_score,
        qa.percent_score,
        CASE WHEN qa.is_passed = 1 THEN 'Да' ELSE 'Нет' END AS passed,
        qa.completed_at
      FROM quiz_attempts qa
      JOIN users   u ON qa.user_id = u.id
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE q.author_id = ?
    `;
    const params = [req.user.id];
    if (quizId) { query += ' AND q.id = ?'; params.push(quizId); }
    query += ' ORDER BY qa.completed_at DESC';
    const [results] = await pool.query(query, params);

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Результаты');
    worksheet.columns = [
      { header: 'Пользователь', key: 'name',          width: 22 },
      { header: 'Email',        key: 'email',         width: 30 },
      { header: 'Квиз',         key: 'quiz_title',    width: 35 },
      { header: 'Баллы',        key: 'score',         width: 10 },
      { header: 'Макс. баллы',  key: 'max_score',     width: 12 },
      { header: '% результат',  key: 'percent_score', width: 14 },
      { header: 'Сдано',        key: 'passed',        width: 10 },
      { header: 'Дата',         key: 'completed_at',  width: 22 },
    ];
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
    results.forEach(r => {
      worksheet.addRow({
        ...r,
        percent_score: Number(r.percent_score).toFixed(1) + '%',
        completed_at:  r.completed_at ? new Date(r.completed_at).toLocaleString('ru') : '',
      });
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=my-quiz-results.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Публикация / снятие с публикации
exports.togglePublish = async (req, res) => {
  try {
    const [[quiz]] = await pool.query(
      'SELECT id, is_published FROM quizzes WHERE id = ? AND author_id = ?',
      [req.params.id, req.user.id]
    );
    if (!quiz) return res.status(404).json({ message: 'Квиз не найден' });

    const newStatus = quiz.is_published ? 0 : 1;
    await pool.query('UPDATE quizzes SET is_published = ? WHERE id = ?', [newStatus, quiz.id]);
    res.json({ is_published: newStatus, message: newStatus ? 'Квиз опубликован' : 'Квиз снят с публикации' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
