const mysql = require('mysql2/promise');

const getEnv = (primary, fallback, defaultValue) => process.env[primary] || process.env[fallback] || defaultValue;

const pool = mysql.createPool({
  host: getEnv('DB_HOST', 'MYSQLHOST', 'localhost'),
  port: parseInt(getEnv('DB_PORT', 'MYSQLPORT', '3306'), 10),
  user: getEnv('DB_USER', 'MYSQLUSER', 'root'),
  password: getEnv('DB_PASSWORD', 'MYSQLPASSWORD', ''),
  database: getEnv('DB_NAME', 'MYSQLDATABASE', 'railway'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

module.exports = pool;
