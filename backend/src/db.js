const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const config = require('./config');

async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
    ...(config.db.ssl ? { ssl: config.db.ssl } : {}),
  });

  if (!config.db.name) {
    throw new Error('DATABASE_NAME is required. Configure DB_NAME or use a URL with a database name.');
  }

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  } catch (error) {
    console.warn('Não foi possível criar o banco de dados automaticamente:', error.message);
  }

  await connection.query(`USE \`${config.db.name}\`;`);

  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const statements = schemaSql
    .split(/;\s*(?=\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await connection.query(statement);
  }

  await connection.end();
}

let pool;

async function getPool() {
  if (!pool) {
    await ensureDatabase();
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  return pool;
}

module.exports = { getPool };
