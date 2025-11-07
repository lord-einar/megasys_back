#!/usr/bin/env node

/**
 * Script to import database backup into Azure PostgreSQL
 * Usage: node scripts/import-database.js /path/to/backup.sql
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

const backupFile = process.argv[2] || path.join(__dirname, '../sql/backup_local.sql');

if (!fs.existsSync(backupFile)) {
  console.error(`❌ Backup file not found: ${backupFile}`);
  process.exit(1);
}

console.log(`📂 Reading backup from: ${backupFile}`);

const sqlContent = fs.readFileSync(backupFile, 'utf-8');

// Create connection to database
const sequelize = new Sequelize({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  dialect: process.env.DB_DIALECT,
  logging: false,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? { require: true, rejectUnauthorized: false } : false,
    connectTimeout: 60000
  }
});

async function importDatabase() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    console.log('📥 Importing backup...');

    // Split SQL content by statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    let executed = 0;
    let skipped = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      try {
        if (i % 50 === 0) {
          console.log(`⏳ Processing statement ${i}/${statements.length}...`);
        }

        await sequelize.query(statement);
        executed++;
      } catch (error) {
        // Skip non-critical errors
        if (error.message.includes('already exists') ||
            error.message.includes('duplicate') ||
            error.message.includes('relation') ||
            error.message.includes('does not exist')) {
          skipped++;
        } else {
          console.error(`❌ Error executing statement ${i}:`, error.message.substring(0, 100));
          console.error('   Statement:', statement.substring(0, 100));
        }
      }
    }

    console.log(`\n✅ Import completed!`);
    console.log(`   Executed: ${executed} statements`);
    console.log(`   Skipped: ${skipped} statements`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to import database:', error.message);
    process.exit(1);
  }
}

importDatabase();
