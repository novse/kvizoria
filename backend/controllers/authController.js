const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const nodemailer = require('nodemailer');

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: 'Все поля обязательны' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Пароль минимум 6 символов' });

    const [[exist]] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?', [email, username]
    );
    if (exist) return res.status(409).json({ message: 'Email или имя пользователя уже заняты' });

    const hash = await bcrypt.hash(password, 10);
    const uuid = uuidv4();
    await pool.query(
      'INSERT INTO users (uuid, username, email, password_hash) VALUES (?, ?, ?, ?)',
      [uuid, username, email, hash]
    );
    const [[user]] = await pool.query(
      'SELECT id, uuid, username, email, role, avatar FROM users WHERE uuid = ?', [uuid]
    );
    res.status(201).json({ token: signToken(user.id), user });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Введите email и пароль' });

    const [[user]] = await pool.query(
      'SELECT * FROM users WHERE email = ?', [email]
    );
    if (!user) return res.status(401).json({ message: 'Неверный email или пароль' });
    if (user.is_blocked) return res.status(403).json({ message: 'Аккаунт заблокирован' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Неверный email или пароль' });

    const { password_hash, reset_token, ...safeUser } = user;
    res.json({ token: signToken(user.id), user: safeUser });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера', error: err.message });
  }
};

exports.me = async (req, res) => {
  const [[user]] = await pool.query(
    'SELECT id, uuid, username, email, role, avatar, bio, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  res.json(user);
};

exports.updateProfile = async (req, res) => {
  try {
    const { username, bio } = req.body;
    const avatar = req.file ? `/uploads/${req.file.filename}` : undefined;
    const fields = [];
    const vals = [];
    if (username) { fields.push('username = ?'); vals.push(username); }
    if (bio !== undefined) { fields.push('bio = ?'); vals.push(bio); }
    if (avatar) { fields.push('avatar = ?'); vals.push(avatar); }
    if (!fields.length) return res.status(400).json({ message: 'Нечего обновлять' });
    vals.push(req.user.id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [[updated]] = await pool.query(
      'SELECT id, uuid, username, email, role, avatar, bio FROM users WHERE id = ?', [req.user.id]
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка обновления', error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const [[user]] = await pool.query('SELECT id, email FROM users WHERE email = ?', [email]);
    if (!user) return res.json({ message: 'Если email существует, письмо отправлено' });

    const token = uuidv4();
    const expires = new Date(Date.now() + 3600000); // 1 час
    await pool.query(
      'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
      [token, expires, user.id]
    );

    if (process.env.SMTP_USER) {
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: `"Квизория" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Сброс пароля — Квизория',
        html: `<p>Ссылка для сброса пароля (действует 1 час):</p>
               <a href="${process.env.CLIENT_URL}/reset-password/${token}">Сбросить пароль</a>`
      });
    }
    res.json({ message: 'Если email существует, письмо отправлено', devToken: process.env.NODE_ENV !== 'production' ? token : undefined });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка отправки письма', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6)
      return res.status(400).json({ message: 'Неверные данные' });

    const [[user]] = await pool.query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()', [token]
    );
    if (!user) return res.status(400).json({ message: 'Ссылка устарела или неверная' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
      [hash, user.id]
    );
    res.json({ message: 'Пароль успешно изменён' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сброса пароля' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'Заполните все поля. Пароль — минимум 6 символов' });

    const [[user]] = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = ?', [req.user.id]
    );
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(400).json({ message: 'Неверный текущий пароль' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);

    res.json({ message: 'Пароль успешно изменён' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка смены пароля' });
  }
};
