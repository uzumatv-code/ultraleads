const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./db');
const leadsRouter = require('./routes/leads');
const messagesRouter = require('./routes/messages');
const dashboardRouter = require('./routes/dashboard');
const aiSettingsRouter = require('./routes/aiSettings');
const webhooksRouter = require('./routes/webhooks');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/leads', leadsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ai-settings', aiSettingsRouter);
app.use('/api/webhooks', webhooksRouter);

app.get('/api/settings', (req, res) => {
  res.json({ dailyLimit: config.dailyLimit });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const staticPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Endpoint API não encontrado.' });
    }
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  console.warn('Pasta de frontend não encontrada em', staticPath);
}

async function startServer() {
  try {
    const pool = await db.getPool();
    await pool.getConnection();
    app.listen(config.port, () => {
      console.log('Conectado ao MySQL.');
      console.log(`Backend rodando em http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('Não foi possível conectar ao MySQL:', error);
    process.exit(1);
  }
}

startServer();
