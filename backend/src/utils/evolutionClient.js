const axios = require('axios');
const config = require('../config');

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 11 ? `55${digits}` : digits;
}

function getEvolutionError(error) {
  const status = error.response?.status || 500;
  const data = error.response?.data;
  const invalidNumber = data?.response?.message?.find?.((item) => item && item.exists === false);
  const apiMessage =
    (invalidNumber ? `O telefone ${invalidNumber.number} nao aparece como WhatsApp valido na Evolution.` : null) ||
    data?.message ||
    data?.error ||
    data?.response?.message ||
    (typeof data === 'string' ? data : null) ||
    error.message;

  const details = typeof data === 'object' ? JSON.stringify(data) : String(data || '');
  return {
    status,
    message: `Evolution API: ${apiMessage}`,
    details,
  };
}

async function checkWhatsAppNumber(phone) {
  const apiUrl = normalizeBaseUrl(config.evolution.apiUrl);
  const instanceId = String(config.evolution.instanceId || '').trim();
  const number = normalizePhone(phone);

  if (!apiUrl || !config.evolution.apiKey || !instanceId) {
    throw Object.assign(new Error('Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_ID.'), {
      status: 400,
    });
  }

  if (!number) {
    return { number, exists: false };
  }

  try {
    const response = await axios.post(
      `${apiUrl}/chat/whatsappNumbers/${encodeURIComponent(instanceId)}`,
      { numbers: [number] },
      {
        headers: {
          apikey: config.evolution.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    const result = Array.isArray(response.data) ? response.data[0] : response.data?.numbers?.[0];
    return {
      number,
      exists: Boolean(result?.exists),
      jid: result?.jid,
    };
  } catch (error) {
    const evolutionError = getEvolutionError(error);
    throw Object.assign(new Error(evolutionError.message), {
      status: evolutionError.status,
      details: evolutionError.details,
    });
  }
}

async function sendWhatsAppMessage(phone, text) {
  const apiUrl = normalizeBaseUrl(config.evolution.apiUrl);
  const instanceId = String(config.evolution.instanceId || '').trim();
  const number = normalizePhone(phone);

  if (!apiUrl || !config.evolution.apiKey || !instanceId) {
    throw Object.assign(new Error('Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_ID.'), {
      status: 400,
    });
  }

  if (!number) {
    throw Object.assign(new Error('WhatsApp do lead esta vazio ou invalido.'), { status: 400 });
  }

  const url = `${apiUrl}/message/sendText/${encodeURIComponent(instanceId)}`;
  const payload = {
    number,
    text,
    delay: 1200,
    linkPreview: false,
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        apikey: config.evolution.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    const evolutionError = getEvolutionError(error);
    console.error('Evolution sendText failed:', {
      status: evolutionError.status,
      url,
      number,
      response: evolutionError.details,
    });
    throw Object.assign(new Error(evolutionError.message), {
      status: evolutionError.status,
      details: evolutionError.details,
    });
  }
}

module.exports = { checkWhatsAppNumber, sendWhatsAppMessage };
