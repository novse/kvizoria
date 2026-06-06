const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Токен не предоставлен' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [[user]] = await pool.query(
      'SELECT id, uuid, username, email, role, avatar, is_blocked FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (!user) return res.status(401).json({ message: 'Пользователь не найден' });
    if (user.is_blocked) return res.status(403).json({ message: 'Аккаунт заблокирован' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Недействительный токен' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Доступ только для администраторов' });
  next();
};

const creatorOrAdmin = (req, res, next) => {
  if (!['creator', 'admin'].includes(req.user?.role))
    return res.status(403).json({ message: 'Доступ только для создателей квизов' });
  next();
};

// Новая функция: проверка лимита попыток для квиза
const checkQuizAttempts = async (req, res, next) => {
  const { uuid } = req.params;
  const userId = req.user.id;
  const maxAttempts = 3; // стандартное значение, можно переопределить из настроек квиза

  try {
    // Получаем ID квиза и его настройки лимита
    const [[quiz]] = await pool.query(
      'SELECT id, max_attempts FROM quizzes WHERE uuid = ?',
      [uuid]
    );
    
    if (!quiz) {
      return res.status(404).json({ message: 'Квиз не найден' });
    }

    const actualMaxAttempts = quiz.max_attempts || maxAttempts;
    
    // Считаем количество завершённых попыток
    const [[attempts]] = await pool.query(
      'SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? AND completed_at IS NOT NULL',
      [userId, quiz.id]
    );

    if (attempts.count >= actualMaxAttempts) {
      return res.status(403).json({ 
        allowed: false, 
        message: `Лимит попыток исчерпан (${actualMaxAttempts}/${actualMaxAttempts})`,
        attemptsLeft: 0,
        maxAttempts: actualMaxAttempts,
        usedAttempts: attempts.count
      });
    }

    // Сохраняем информацию о квизе в req для дальнейшего использования
    req.quizInfo = {
      id: quiz.id,
      maxAttempts: actualMaxAttempts,
      attemptsLeft: actualMaxAttempts - attempts.count,
      usedAttempts: attempts.count
    };
    
    next();
  } catch (err) {
    console.error('Check attempts error:', err);
    res.status(500).json({ message: 'Ошибка при проверке лимита попыток' });
  }
};

module.exports = { auth, adminOnly, creatorOrAdmin, checkQuizAttempts };
