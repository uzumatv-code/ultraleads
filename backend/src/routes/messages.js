const express = require('express');
const { getPool } = require('../db');
const config = require('../config');
const { getOpenAIClient } = require('../utils/openaiClient');
const { buildMessagePrompt, getAiSettings, getFallbackMessage } = require('../utils/aiSettings');

const router = express.Router();

router.get('/:leadId', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM messages WHERE lead_id = ? ORDER BY sent_at DESC', [req.params.leadId]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar histórico de mensagens.' });
  }
});

router.post('/:leadId/generate', async (req, res) => {
  const { leadId } = req.params;
  try {
    const pool = await getPool();
    const [leadRows] = await pool.query('SELECT * FROM leads WHERE id = ?', [leadId]);
    const lead = leadRows[0];
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });

    const aiSettings = await getAiSettings(pool);
    const prompt = buildMessagePrompt(lead, aiSettings);
    let text;

    if (config.openaiKey) {
      try {
        const openai = getOpenAIClient();
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 120,
        });
        text = response.choices?.[0]?.message?.content?.trim();
      } catch (openaiError) {
        console.warn('OpenAI generation failed:', openaiError?.message || openaiError);
      }
    }

    if (!text) {
      text = getFallbackMessage(lead, aiSettings);
    }

    res.json({ message: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar mensagem.' });
  }
});

router.post('/:leadId/send', async (req, res) => {
  const { leadId } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Texto da mensagem é obrigatório.' });
  }

  try {
    const pool = await getPool();
    const [leadRows] = await pool.query('SELECT * FROM leads WHERE id = ?', [leadId]);
    const lead = leadRows[0];
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });

    const [todayRows] = await pool.query(
      "SELECT COUNT(*) AS count FROM messages WHERE direction = 'sent' AND DATE(sent_at) = CURDATE()"
    );
    const sentToday = todayRows[0]?.count || 0;

    if (sentToday >= config.dailyLimit) {
      return res.status(400).json({ error: `Limite diário de ${config.dailyLimit} mensagens atingido.` });
    }

    const { sendWhatsAppMessage } = require('../utils/evolutionClient');
    await sendWhatsAppMessage(lead.phone, text);

    await pool.query(
      'INSERT INTO messages (lead_id, direction, content, sent_at) VALUES (?, ?, ?, NOW())',
      [leadId, 'sent', text]
    );

    await pool.query(
      'UPDATE leads SET status = ?, last_contact_date = NOW(), updated_at = NOW() WHERE id = ?',
      ['mensagem_enviada', leadId]
    );

    res.json({ success: true, remainingToday: Math.max(config.dailyLimit - sentToday - 1, 0) });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({
      error: error.message || 'Erro ao enviar mensagem pelo WhatsApp.',
      details: error.details,
    });
  }
});

module.exports = router;
