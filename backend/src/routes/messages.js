const express = require('express');
const pool = require('../db');
const config = require('../config');
const { sendWhatsAppMessage } = require('../utils/evolutionClient');
const { Configuration, OpenAIApi } = require('openai');

const router = express.Router();

const openai = config.openaiKey
  ? new OpenAIApi(new Configuration({ apiKey: config.openaiKey }))
  : null;

router.get('/:leadId', async (req, res) => {
  try {
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
    const [leadRows] = await pool.query('SELECT * FROM leads WHERE id = ?', [leadId]);
    const lead = leadRows[0];
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });

    const prompt = `Escreva uma mensagem curta, educada e direta para uma barbearia chamada ${lead.name} localizada no bairro ${lead.neighborhood}. Pergunte se eles trabalham com agenda marcada ou ordem de chegada e destaque que nosso SaaS UltraBarber ajuda a organizar atendimentos e reduzir espera. A mensagem deve ser personalizada, não parecer spam e ficar abaixo de 280 caracteres.`;
    let text;

    if (openai) {
      const response = await openai.createChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
      });
      text = response.data.choices?.[0]?.message?.content?.trim();
    }

    if (!text) {
      text = `Olá ${lead.name}, tudo bem? Gostaria de saber se vocês trabalham mais com agenda marcada ou ordem de chegada. O UltraBarber ajuda a organizar atendimentos e reduzir filas com mensagens via WhatsApp.`;
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
    res.status(500).json({ error: 'Erro ao enviar mensagem pelo WhatsApp.' });
  }
});

module.exports = router;
