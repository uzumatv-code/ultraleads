const express = require('express');
const { getPool } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const [leadCountRows] = await pool.query('SELECT status, COUNT(*) AS count FROM leads GROUP BY status');
    const [messageCountRows] = await pool.query("SELECT COUNT(*) AS count FROM messages WHERE direction = 'sent'");
    const [responseCountRows] = await pool.query("SELECT COUNT(*) AS count FROM leads WHERE status IN ('respondeu','interessado','reuniao_marcada','cliente')");
    const [interestedRows] = await pool.query("SELECT COUNT(*) AS count FROM leads WHERE status = 'interessado'");
    const [meetingRows] = await pool.query("SELECT COUNT(*) AS count FROM leads WHERE status = 'reuniao_marcada'");
    const [clientRows] = await pool.query("SELECT COUNT(*) AS count FROM leads WHERE status = 'cliente'");

    const statusCounts = leadCountRows.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});

    res.json({
      totalLeads: leadCountRows.reduce((sum, row) => sum + row.count, 0),
      messagesSent: messageCountRows[0]?.count || 0,
      responses: responseCountRows[0]?.count || 0,
      interested: interestedRows[0]?.count || 0,
      meetings: meetingRows[0]?.count || 0,
      clients: clientRows[0]?.count || 0,
      statusCounts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar métricas.' });
  }
});

module.exports = router;
