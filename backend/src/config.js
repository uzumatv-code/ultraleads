require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'ultrabarber_crm',
  },
  evolution: {
    apiKey: process.env.EVOLUTION_API_KEY,
    instanceId: process.env.EVOLUTION_INSTANCE_ID,
  },
  openaiKey: process.env.OPENAI_API_KEY,
  dailyLimit: Number(process.env.DAILY_SEND_LIMIT || 10),
};
