const express = require('express');
const { getPool } = require('../db');
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
