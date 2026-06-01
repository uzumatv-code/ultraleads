const OpenAI = require('openai');
const config = require('../config');

let client;

function getOpenAIClient() {
  if (!config.openaiKey) return null;
  if (!client) {
    client = new OpenAI({ apiKey: config.openaiKey });
  }
  return client;
}

module.exports = { getOpenAIClient };
