const express = require('express');
const { getPool } = require('../db');
const { AI_PROFILES, getAiSettings, normalizeProfile } = require('../utils/aiSettings');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const settings = await getAiSettings(pool);
    res.json({ ...settings, profiles: AI_PROFILES });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar configuracao da IA.' });
  }
});

router.put('/', async (req, res) => {
  const activeProfile = normalizeProfile(req.body.activeProfile);
  const customInstructions = String(req.body.customInstructions || '').slice(0, 3000);

  try {
    const pool = await getPool();
    await pool.query(
      `INSERT INTO ai_settings (id, active_profile, custom_instructions)
       VALUES (1, ?, ?)
       ON DUPLICATE KEY UPDATE active_profile = VALUES(active_profile), custom_instructions = VALUES(custom_instructions)`,
      [activeProfile, customInstructions]
    );
    const settings = await getAiSettings(pool);
    res.json({ ...settings, profiles: AI_PROFILES });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar configuracao da IA.' });
  }
});

module.exports = router;
