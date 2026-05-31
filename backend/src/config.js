require('dotenv').config();

function parseDatabaseUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const sslParam = parsed.searchParams.get('ssl') || parsed.searchParams.get('sslmode');
    const ssl = sslParam ? { rejectUnauthorized: false } : undefined;
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      name: parsed.pathname?.replace(/^\//, '') || undefined,
      ssl,
    };
  } catch (error) {
    console.warn('DATABASE URL parsing failed:', error.message);
    return null;
  }
}

const dbUrl = parseDatabaseUrl(
  process.env.DATABASE_URL ||
  process.env.RAILWAY_DATABASE_URL ||
  process.env.MYSQL_URL ||
  process.env.MYSQL_URI ||
  process.env.CLEARDB_DATABASE_URL
);

const defaultDb = {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
  name: process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.MYSQL_DB || 'ultrabarber_crm',
};

const dbConfig = dbUrl || defaultDb;
const envPort = Number(process.env.PORT || 0);
const port = envPort && dbConfig.port && envPort === dbConfig.port ? 8080 : envPort || 8080;

module.exports = {
  port,
  db: dbConfig,
  evolution: {
    apiKey: process.env.EVOLUTION_API_KEY,
    instanceId: process.env.EVOLUTION_INSTANCE_ID,
  },
  openaiKey: process.env.OPENAI_API_KEY,
  dailyLimit: Number(process.env.DAILY_SEND_LIMIT || 10),
};
