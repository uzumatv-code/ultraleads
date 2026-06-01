const express = require('express');
const { getPool } = require('../db');
const config = require('../config');
const { getOpenAIClient } = require('../utils/openaiClient');

const router = express.Router();

const STATUS_MAP = {
  interested: 'interessado',
  meeting: 'reuniao_marcada',
  rejected: 'recusou',
  client: 'cliente',
  replied: 'respondeu',
};

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function extractRemotePhone(remoteJid = '') {
  return normalizePhone(String(remoteJid).split('@')[0]);
}

function extractMessageText(message = {}) {
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.title ||
    ''
  ).trim();
}

function extractPayload(body) {
  const data = body.data || body;
  const key = data.key || body.key || {};
  const message = data.message || body.message || {};

  return {
    event: String(body.event || '').toUpperCase(),
    instance: body.instance || data.instance || '',
    fromMe: Boolean(key.fromMe),
    messageId: key.id || data.id || '',
    remotePhone: extractRemotePhone(key.remoteJid || data.remoteJid || body.sender || ''),
    pushName: data.pushName || body.pushName || '',
    text: extractMessageText(message),
    timestamp: data.messageTimestamp ? new Date(Number(data.messageTimestamp) * 1000) : new Date(),
  };
}

async function findOrCreateLead(pool, payload) {
  const [rows] = await pool.query('SELECT * FROM leads ORDER BY updated_at DESC');
  const remoteDigits = normalizePhone(payload.remotePhone);
  const lead = rows.find((item) => normalizePhone(item.phone).endsWith(remoteDigits.slice(-11)));
  if (lead) return lead;

  const name = payload.pushName || `WhatsApp ${payload.remotePhone}`;
  const [result] = await pool.query(
    'INSERT INTO leads (name, phone, notes, status) VALUES (?, ?, ?, ?)',
    [name, payload.remotePhone || null, 'Criado automaticamente por resposta recebida via Evolution.', 'respondeu']
  );
  const [createdRows] = await pool.query('SELECT * FROM leads WHERE id = ?', [result.insertId]);
  return createdRows[0];
}

async function analyzeReply({ lead, text }) {
  const fallback = {
    status: 'respondeu',
    suggestion: `Oi ${lead.name}, obrigado pelo retorno. Posso te mostrar rapidinho como o UltraBarber organiza agenda, colaboradores e comissoes?`,
  };

  if (!config.openaiKey) return fallback;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Voce analisa respostas de leads de barbearias para um CRM de vendas do UltraBarber. Classifique a intencao e gere uma resposta curta para WhatsApp. Nunca invente fatos.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            lead: {
              name: lead.name,
              phone: lead.phone,
              neighborhood: lead.neighborhood,
              status: lead.status,
              notes: lead.notes,
            },
            incomingMessage: text,
            allowedStatuses: Object.keys(STATUS_MAP),
            outputFormat: {
              status: 'interested | meeting | rejected | client | replied',
              suggestion: 'mensagem curta para responder no WhatsApp',
            },
          }),
        },
      ],
      response_format: {
        type: 'json_object',
      },
      max_tokens: 250,
    });

    const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
    return {
      status: STATUS_MAP[parsed.status] || fallback.status,
      suggestion: parsed.suggestion || fallback.suggestion,
    };
  } catch (error) {
    console.warn('Reply analysis failed:', error.message);
    return fallback;
  }
}

router.post('/evolution', async (req, res) => {
  try {
    const payload = extractPayload(req.body || {});

    if (payload.fromMe || !payload.text || !payload.remotePhone) {
      return res.json({ ignored: true });
    }

    const pool = await getPool();
    const lead = await findOrCreateLead(pool, payload);

    await pool.query(
      'INSERT INTO messages (lead_id, direction, content, sent_at) VALUES (?, ?, ?, ?)',
      [lead.id, 'received', payload.text, payload.timestamp]
    );

    const analysis = await analyzeReply({ lead, text: payload.text });
    await pool.query(
      'INSERT INTO messages (lead_id, direction, content, sent_at) VALUES (?, ?, ?, NOW())',
      [lead.id, 'suggested', analysis.suggestion]
    );
    await pool.query(
      'UPDATE leads SET status = ?, last_contact_date = NOW(), updated_at = NOW() WHERE id = ?',
      [analysis.status, lead.id]
    );

    res.json({ success: true, leadId: lead.id, status: analysis.status });
  } catch (error) {
    console.error('Evolution webhook failed:', error);
    res.status(500).json({ error: 'Erro ao processar webhook da Evolution.' });
  }
});

module.exports = router;
