const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const config = require('./config');

async function connectDatabase(options) {
  return mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    ...(options.database ? { database: options.database } : {}),
    ...(config.db.ssl ? { ssl: config.db.ssl } : {}),
  });
}

async function initializeSchema(connection) {
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const statements = schemaSql
    .split(/;\s*(?=\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await connection.query(statement);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDatabase() {
  if (!config.db.name) {
    throw new Error('DATABASE_NAME is required. Configure DB_NAME or use a URL with a database name.');
  }

  let connection;
  try {
    connection = await connectDatabase({ database: config.db.name });
    await initializeSchema(connection);
    return;
  } catch (error) {
    if (error.code !== 'ER_BAD_DB_ERROR' && error.code !== 'ER_BAD_DB_ERR' && error.code !== 'ER_ACCESS_DENIED_ERROR') {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }

  const maxAttempts = 8;
  const waitMs = 3000;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const adminConnection = await connectDatabase({});
      try {
        await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      } catch (createError) {
        console.warn('Não foi possível criar o banco de dados automaticamente:', createError.message);
      } finally {
        await adminConnection.end();
      }

      connection = await connectDatabase({ database: config.db.name });
      await initializeSchema(connection);
      return;
    } catch (retryError) {
      if (attempt === maxAttempts) {
        throw retryError;
      }
      console.warn(`Banco de dados não disponível ainda (tentativa ${attempt}). Aguardando ${waitMs}ms...`);
      await sleep(waitMs);
    } finally {
      if (connection) {
        await connection.end();
        connection = null;
      }
    }
  }
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
      ...(config.db.ssl ? { ssl: config.db.ssl } : {}),
    });
  }

  return pool;
}

module.exports = { getPool };
