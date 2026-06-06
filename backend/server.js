require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const initDatabase = require('./config/initDb');
const pool = require('./config/db');  // ← ДОБАВИТЬ ЭТУ СТРОКУ

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
const frontendBuild = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendBuild));

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
  try {
    console.log('🚀 Запуск сервера Квизория...');
    console.log('🔄 Подключение к базе данных...');
    
    await initDatabase();
    
    console.log('✅ База данных готова');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Квизория запущена на порту ${PORT}`);
      console.log(`🌐 Сайт: http://0.0.0.0:${PORT}`);
      console.log(`📡 API:  http://0.0.0.0:${PORT}/api`);
    });
  } catch (err) {
    console.error('❌ Фатальная ошибка:', err);
    process.exit(1);
  }
}

start();
