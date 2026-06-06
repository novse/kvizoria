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

module.exports = { auth, adminOnly, creatorOrAdmin };
