const axios = require('axios');
const config = require('../config');

async function sendWhatsAppMessage(phone, text) {
  if (!config.evolution.apiKey || !config.evolution.instanceId) {
    throw new Error('Evolution API key and instance ID are required.');
  }

  const url = `https://api.evolution.com.br/v1/${config.evolution.instanceId}/messages`;
  const payload = {
    to: phone,
    type: 'text',
    text: { body: text },
  };

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${config.evolution.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
}

module.exports = { sendWhatsAppMessage };
