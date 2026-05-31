const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const leadsRouter = require('./routes/leads');
const messagesRouter = require('./routes/messages');
const dashboardRouter = require('./routes/dashboard');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/leads', leadsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/dashboard', dashboardRouter);

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

app.listen(config.port, async () => {
  try {
    await pool.getConnection();
    console.log('Conectado ao MySQL.');
  } catch (error) {
    console.warn('Não foi possível conectar ao MySQL:', error.message);
  }
  console.log(`Backend rodando em http://localhost:${config.port}`);
});
