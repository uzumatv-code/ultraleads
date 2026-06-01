const express = require('express');
const { getPool } = require('../db');
const { discoverLeads, normalizeText } = require('../utils/leadDiscovery');
const router = express.Router();

const VALID_STATUSES = [
  'novo',
  'mensagem_enviada',
  'respondeu',
  'interessado',
  'reuniao_marcada',
  'recusou',
  'cliente',
];

router.get('/', async (req, res) => {
  const status = req.query.status;
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      status && VALID_STATUSES.includes(status)
        ? 'SELECT * FROM leads WHERE status = ? ORDER BY updated_at DESC'
        : 'SELECT * FROM leads ORDER BY updated_at DESC',
      status && VALID_STATUSES.includes(status) ? [status] : []
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar leads.' });
  }
});

router.post('/', async (req, res) => {
  const { name, phone, neighborhood, address, instagram, notes, status } = req.body;
  const leadStatus = VALID_STATUSES.includes(status) ? status : 'novo';

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Nome da barbearia é obrigatório.' });
  }

  try {
    const pool = await getPool();
    const [result] = await pool.query(
      'INSERT INTO leads (name, phone, neighborhood, address, instagram, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, phone, neighborhood, address, instagram, notes, leadStatus]
    );
    const [rows] = await pool.query('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar lead.' });
  }
});

router.post('/discover', async (req, res) => {
  const { city, neighborhood, country, limit, profile } = req.body;
  const cleanCity = String(city || '').trim();

  if (!cleanCity) {
    return res.status(400).json({ error: 'Informe a cidade para buscar leads.' });
  }

  try {
    const pool = await getPool();
    const [existingRows] = await pool.query('SELECT id, name, phone FROM leads');
    const existingNames = new Set(existingRows.map((lead) => normalizeText(lead.name)));
    const existingPhones = new Set(existingRows.map((lead) => normalizeText(lead.phone)).filter(Boolean));

    const candidates = await discoverLeads({
      city: cleanCity,
      neighborhood: String(neighborhood || '').trim(),
      country: String(country || 'Brasil').trim(),
      limit,
      profile: String(profile || '').trim(),
    });

    res.json({
      candidates: candidates.map((candidate) => ({
        ...candidate,
        duplicate:
          existingNames.has(normalizeText(candidate.name)) ||
          (candidate.phone && existingPhones.has(normalizeText(candidate.phone))),
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Erro ao buscar novos leads.' });
  }
});

router.post('/import', async (req, res) => {
  const { name, phone, neighborhood, address, instagram, notes, status, source, reason, nextStep } = req.body;
  const leadStatus = VALID_STATUSES.includes(status) ? status : 'novo';

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Nome da barbearia é obrigatório.' });
  }

  const aiNotes = [
    notes,
    source ? `Fonte: ${source}` : null,
    reason ? `Motivo IA: ${reason}` : null,
    nextStep ? `Próximo passo: ${nextStep}` : null,
  ].filter(Boolean).join('\n');

  try {
    const pool = await getPool();
    const [existingRows] = await pool.query(
      'SELECT * FROM leads WHERE LOWER(name) = LOWER(?) OR (phone IS NOT NULL AND phone <> "" AND phone = ?) LIMIT 1',
      [name.trim(), phone || '']
    );

    if (existingRows[0]) {
      return res.status(409).json({ error: 'Este lead parece já estar cadastrado.', lead: existingRows[0] });
    }

    const [result] = await pool.query(
      'INSERT INTO leads (name, phone, neighborhood, address, instagram, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        name.trim(),
        phone || null,
        neighborhood || null,
        address || null,
        instagram || null,
        aiNotes || null,
        leadStatus,
      ]
    );
    const [rows] = await pool.query('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao importar lead.' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, neighborhood, address, instagram, notes, status, last_contact_date } = req.body;
  const leadStatus = VALID_STATUSES.includes(status) ? status : 'novo';

  try {
    const pool = await getPool();
    await pool.query(
      'UPDATE leads SET name = ?, phone = ?, neighborhood = ?, address = ?, instagram = ?, notes = ?, status = ?, last_contact_date = ?, updated_at = NOW() WHERE id = ?',
      [name, phone, neighborhood, address, instagram, notes, leadStatus, last_contact_date || null, id]
    );
    const [rows] = await pool.query('SELECT * FROM leads WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar lead.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Lead não encontrado.' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar lead.' });
  }
});

router.get('/:id/followup', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    const lead = rows[0];
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });

    const sentOn = lead.last_contact_date ? new Date(lead.last_contact_date) : null;
    const daysSince = sentOn ? Math.floor((Date.now() - sentOn.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const eligible = lead.status === 'mensagem_enviada' && daysSince !== null && daysSince >= 2;

    res.json({
      eligible,
      daysSince,
      suggestion: eligible
        ? `Oi ${lead.name}, tudo bem? Só passando para saber se você gostou da nossa proposta para organizar melhor a agenda da barbearia.`
        : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar sugestão de follow-up.' });
  }
});

module.exports = router;
