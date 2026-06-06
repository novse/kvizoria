require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const initDatabase = require('./config/initDb');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Загруженные файлы
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API ROUTES ───────────────────────────────────────────────
app.use('/api', require('./routes/index'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'Квизория' }));

// ─── SERVE REACT BUILD ────────────────────────────────────────
// Бэкенд раздаёт собранный фронтенд как статику
const frontendBuild = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendBuild));

// Все остальные запросы → React (SPA routing)
app.get('*', (req, res) => {
  const indexPath = path.join(frontendBuild, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).json({ message: 'Квизория API работает. Фронтенд не собран.' });
    }
  });
});

// ─── START ────────────────────────────────────────────────────
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Квизория запущена на порту ${PORT}`);
    console.log(`🌐 Сайт: http://localhost:${PORT}`);
    console.log(`📡 API:  http://localhost:${PORT}/api`);
  });
}

start().catch(err => {
  console.error('Фатальная ошибка:', err);
  process.exit(1);
});
