const mysql = require('mysql2/promise');
const path  = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const dbConfig = process.env.DATABASE_URL
  ? process.env.DATABASE_URL
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 3306,
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '12345@Sh',
      database: process.env.DB_NAME     || 'zarafi',
      waitForConnections: true,
      connectionLimit:    10,
      queueLimit:         0,
    };

const pool = mysql.createPool(dbConfig);

// Test connection on startup
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected successfully');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }
})();

module.exports = pool;
