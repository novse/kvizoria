const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Railway предоставляет переменные MYSQL_* для подключенной БД
// Также оставляем поддержку ручных DB_* переменных
const dbConfig = {
    host: process.env.MYSQL_HOST || process.env.DB_HOST,
    user: process.env.MYSQL_USER || process.env.DB_USER,
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME,
    port: parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Отладка — что реально используется
console.log('🔧 Конфигурация БД:');
console.log(`   Хост: ${dbConfig.host || '❌ не задан'}`);
console.log(`   Пользователь: ${dbConfig.user || '❌ не задан'}`);
console.log(`   База: ${dbConfig.database || '❌ не задан'}`);
console.log(`   Порт: ${dbConfig.port}`);
console.log(`   Пароль: ${dbConfig.password ? '✅ задан' : '❌ не задан'}`);

if (!dbConfig.host || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
    console.error('❌ ОШИБКА: Не все параметры БД заданы!');
    console.error('   Доступные переменные окружения:');
    console.error('   MYSQL_HOST:', process.env.MYSQL_HOST);
    console.error('   MYSQL_USER:', process.env.MYSQL_USER);
    console.error('   MYSQL_DATABASE:', process.env.MYSQL_DATABASE);
    console.error('   DB_HOST:', process.env.DB_HOST);
    console.error('   DB_USER:', process.env.DB_USER);
    console.error('   DB_NAME:', process.env.DB_NAME);
}

const pool = mysql.createPool(dbConfig);

// Функция инициализации БД (та же, что была)
async function initDatabase() {
    let conn = null;
    
    try {
        console.log('🗄️  Проверяем базу данных...');
        
        conn = await pool.getConnection();
        
        const [[connectionInfo]] = await conn.query(`
            SELECT DATABASE() AS database_name, @@hostname AS host, @@port AS port
        `);
        
        console.log(`🔌 Подключение: ${connectionInfo.database_name}@${connectionInfo.host}:${connectionInfo.port}`);
        
        // ... (весь код создания таблиц и заполнения данными без изменений)
        // (скопируйте из предыдущего сообщения)
        
        console.log('✅ Инициализация БД завершена');
        
    } catch (err) {
        console.error('❌ Ошибка инициализации БД:', err.message);
        throw err;
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { pool, initDatabase };
