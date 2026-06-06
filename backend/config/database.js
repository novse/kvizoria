const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Создаём пул соединений
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Функция инициализации БД
async function initDatabase() {
    let conn = null;
    
    try {
        console.log('🗄️  Проверяем базу данных...');
        
        conn = await pool.getConnection();
        
        const [[connectionInfo]] = await conn.query(`
            SELECT DATABASE() AS database_name, @@hostname AS host, @@port AS port
        `);
        
        console.log(`🔌 Подключение: ${connectionInfo.database_name}@${connectionInfo.host}:${connectionInfo.port}`);
        
        // ─── СОЗДАНИЕ ТАБЛИЦ ───────────────────────────────────────
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                uuid VARCHAR(36) UNIQUE NOT NULL,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('user','creator','admin') DEFAULT 'user',
                avatar VARCHAR(255) DEFAULT NULL,
                bio TEXT DEFAULT NULL,
                reset_token VARCHAR(255) DEFAULT NULL,
                reset_expires DATETIME DEFAULT NULL,
                is_blocked TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) UNIQUE NOT NULL,
                icon VARCHAR(50) DEFAULT '🎯',
                color VARCHAR(20) DEFAULT '#7C3AED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS quizzes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                uuid VARCHAR(36) UNIQUE NOT NULL,
                slug VARCHAR(255) UNIQUE DEFAULT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                cover_image VARCHAR(255) DEFAULT NULL,
                category_id INT DEFAULT NULL,
                author_id INT NOT NULL,
                quiz_type ENUM('classic','timed','picture','open','learning','team') DEFAULT 'classic',
                difficulty ENUM('easy','medium','hard') DEFAULT 'medium',
                time_limit INT DEFAULT NULL,
                max_attempts INT DEFAULT 3,
                is_public TINYINT(1) DEFAULT 1,
                is_published TINYINT(1) DEFAULT 0,
                shuffle_questions TINYINT(1) DEFAULT 1,
                shuffle_answers TINYINT(1) DEFAULT 1,
                pass_score INT DEFAULT 60,
                plays_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS questions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                quiz_id INT NOT NULL,
                text VARCHAR(1000) NOT NULL,
                image VARCHAR(255) DEFAULT NULL,
                question_type ENUM('single','multiple','text') DEFAULT 'single',
                explanation TEXT DEFAULT NULL,
                points INT DEFAULT 1,
                time_limit INT DEFAULT NULL,
                order_num INT DEFAULT 0,
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS answers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                question_id INT NOT NULL,
                text VARCHAR(500) NOT NULL,
                is_correct TINYINT(1) DEFAULT 0,
                order_num INT DEFAULT 0,
                FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                uuid VARCHAR(36) UNIQUE NOT NULL,
                quiz_id INT NOT NULL,
                user_id INT NOT NULL,
                score INT DEFAULT 0,
                max_score INT DEFAULT 0,
                percent_score DECIMAL(5,2) DEFAULT 0,
                time_spent INT DEFAULT 0,
                is_passed TINYINT(1) DEFAULT 0,
                violations_count INT DEFAULT 0,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS attempt_answers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                attempt_id INT NOT NULL,
                question_id INT NOT NULL,
                answer_id INT DEFAULT NULL,
                text_answer VARCHAR(500) DEFAULT NULL,
                is_correct TINYINT(1) DEFAULT 0,
                FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS violations_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                attempt_id INT DEFAULT NULL,
                user_id INT NOT NULL,
                quiz_id INT NOT NULL,
                violation_type VARCHAR(50) NOT NULL,
                description VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS leaderboard (
                id INT AUTO_INCREMENT PRIMARY KEY,
                quiz_id INT NOT NULL,
                user_id INT NOT NULL,
                best_score INT DEFAULT 0,
                best_percent DECIMAL(5,2) DEFAULT 0,
                best_time INT DEFAULT 0,
                attempts_count INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_quiz_user (quiz_id, user_id),
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS db_initialized (
                id INT PRIMARY KEY DEFAULT 1,
                initialized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Таблицы проверены/созданы');
        
        // Проверяем, нужно ли заполнять тестовыми данными
        const [[initialized]] = await conn.query(`SELECT COUNT(*) AS count FROM db_initialized`);
        
        if (initialized.count === 0) {
            console.log('🌱 Заполняем базу тестовыми данными...');
            
            await conn.query(`
                INSERT IGNORE INTO categories (name, slug, icon, color) VALUES
                ('Наука и природа', 'science', '🔬', '#7C3AED'),
                ('История', 'history', '📜', '#DC2626'),
                ('Поп-культура', 'popculture', '🎬', '#DB2777'),
                ('Информационные технологии', 'it', '💻', '#2563EB'),
                ('Спорт', 'sport', '⚽', '#16A34A'),
                ('География', 'geography', '🌍', '#0891B2'),
                ('Кино и музыка', 'cinema', '🎵', '#D97706'),
                ('Литература', 'literature', '📚', '#7C3AED')
            `);
            
            const adminHash = await bcrypt.hash('Admin2024!', 10);
            const creatorHash = await bcrypt.hash('Creator2024!', 10);
            const userHash = await bcrypt.hash('User2024!', 10);
            
            await conn.query(`
                INSERT IGNORE INTO users (uuid, username, email, password_hash, role, bio) VALUES
                (UUID(), 'admin', 'admin@kvizoria.ru', ?, 'admin', 'Главный администратор'),
                (UUID(), 'elena_creator', 'elena@kvizoria.ru', ?, 'creator', 'Создатель квизов'),
                (UUID(), 'test_user', 'user@kvizoria.ru', ?, 'user', 'Обычный пользователь')
            `, [adminHash, creatorHash, userHash]);
            
            await conn.query(`
                INSERT INTO db_initialized (id) VALUES (1)
                ON DUPLICATE KEY UPDATE initialized_at = CURRENT_TIMESTAMP
            `);
            
            console.log('✅ Тестовые данные добавлены');
        } else {
            console.log('📦 База данных уже инициализирована');
        }
        
        console.log('✅ Инициализация БД завершена');
        
    } catch (err) {
        console.error('❌ Ошибка инициализации БД:', err.message);
        throw err;
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { pool, initDatabase };
