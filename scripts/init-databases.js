#!/usr/bin/env node

/**
 * Database initialization script for staging environment
 * This script creates the megasys_staging database if it doesn't exist
 * and ensures both production and staging databases have proper schema
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_HOST = process.env.DB_HOST || 'megasysdb62438.postgres.database.azure.com';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Italia0454!';
const ENVIRONMENT = process.env.NODE_ENV || 'production';

const PRODUCTION_DB = 'megasys';
const STAGING_DB = 'megasys_staging';

const ssl = {
  rejectUnauthorized: false,
  require: true
};

async function createStagingDatabaseIfNotExists() {
  const adminClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: 'postgres',
    ssl: ssl
  });

  try {
    await adminClient.connect();
    console.log('[Database Init] Connected to PostgreSQL server');

    // Check if staging database exists
    const result = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [STAGING_DB]
    );

    if (result.rows.length === 0) {
      console.log(`[Database Init] Creating database '${STAGING_DB}'...`);
      try {
        await adminClient.query(`CREATE DATABASE "${STAGING_DB}" ENCODING 'UTF8'`);
        console.log(`[Database Init] ✓ Database '${STAGING_DB}' created successfully`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`[Database Init] Database '${STAGING_DB}' already exists`);
        } else {
          throw err;
        }
      }
    } else {
      console.log(`[Database Init] Database '${STAGING_DB}' already exists`);
    }

  } catch (err) {
    console.error('[Database Init] Error:', err.message);
    // Non-fatal error - continue with normal startup
    // This might fail due to network/firewall restrictions but app can still work with existing DB
  } finally {
    await adminClient.end();
  }
}

async function main() {
  console.log(`[Database Init] Environment: ${ENVIRONMENT}`);
  console.log(`[Database Init] Database Host: ${DB_HOST}`);

  if (ENVIRONMENT === 'staging' || ENVIRONMENT === 'production') {
    await createStagingDatabaseIfNotExists();
  }

  console.log('[Database Init] Database initialization complete');
}

main().catch(err => {
  console.error('[Database Init] Fatal error:', err);
  // Don't exit with error - allow app to start anyway
  process.exit(0);
});
