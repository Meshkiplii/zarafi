const fs = require('fs');
const path = require('path');
const db = require('../config/db');

(async () => {
  try {
    console.log('🔄 Reading schema.sql...');
    const schemaPath = path.join(__dirname, '../config/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // Split queries by semicolon, remove comments, and filter out empty lines
    const queries = sql
      .split(';')
      .map(q => q.replace(/--.*$/gm, '').trim()) // remove SQL comments
      .filter(q => q.length > 0);

    console.log(`🚀 Found ${queries.length} queries to execute.`);

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const upperQuery = query.toUpperCase();

      // Skip database creation/use statements as they are pre-configured in Railway
      if (upperQuery.startsWith('CREATE DATABASE') || upperQuery.startsWith('USE ')) {
        console.log(`⚠️ Skipping DB environment configuration query (not needed on Railway): "${query.substring(0, 30)}..."`);
        continue;
      }

      console.log(`Executing query ${i + 1}/${queries.length}...`);
      await db.query(query);
    }

    console.log('✅ Database schema initialized successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error initializing database:', err);
    process.exit(1);
  }
})();
