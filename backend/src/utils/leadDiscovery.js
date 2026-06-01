const config = require('../config');

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function extractJson(text) {
  const clean = String(text || '').trim();
  if (!clean) return null;

  try {
    return JSON.parse(clean);
  } catch (error) {
    const match = clean.match(/```(?:json)?\s*([\s\S]*?)```/) || clean.match(/(\{[\s\S]*\})/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch (parseError) {
      return null;
    }
  }
}

function getOutputText(response) {
  if (response.output_text) return response.output_text;

  return (response.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('\n');
}

function getSources(response) {
  const sources = response.sources || [];
  const citations = (response.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .flatMap((content) => content.annotations || [])
    .filter((annotation) => annotation.type === 'url_citation')
    .map((annotation) => ({ url: annotation.url, title: annotation.title }));

  return [...sources, ...citations]
    .filter((source) => source?.url)
    .map((source) => ({ url: source.url, title: source.title || source.url }));
}

function normalizeLead(raw, index, fallbackSource) {
  const name = String(raw.name || '').trim();
  if (!name) return null;

  const sourceUrl = raw.sourceUrl || raw.website || raw.googleMapsUri || fallbackSource?.url || '';
  return {
    externalId: `web/${normalizeText(`${name}|${raw.address || ''}|${sourceUrl || index}`)}`,
    name,
    phone: normalizePhone(raw.phone),
    neighborhood: String(raw.neighborhood || '').trim(),
    address: String(raw.address || '').trim(),
    instagram: String(raw.instagram || '').trim(),
    website: String(raw.website || '').trim(),
    googleMapsUri: String(raw.googleMapsUri || '').trim(),
    sourceUrl,
    source: raw.source || 'Pesquisa web com IA',
    score: Math.min(Math.max(Number(raw.score || 60), 0), 100),
    reason: String(raw.reason || 'Encontrado em pesquisa web; validar dados antes do contato.').trim(),
    nextStep: String(raw.nextStep || 'Confirmar WhatsApp e responsavel antes de abordar.').trim(),
  };
}

function buildFallbackFromSources(sources, limit) {
  return sources.slice(0, limit).map((source, index) => ({
    externalId: `web/source-${index}-${normalizeText(source.url)}`,
    name: source.title || `Lead encontrado ${index + 1}`,
    phone: '',
    neighborhood: '',
    address: '',
    instagram: '',
    website: source.url,
    googleMapsUri: '',
    sourceUrl: source.url,
    source: 'Pesquisa web com IA',
    score: Math.max(55, 85 - index * 5),
    reason: 'Fonte encontrada pela pesquisa web da IA; revisar a pagina antes de importar.',
    nextStep: 'Abrir a fonte e validar nome, telefone e responsavel pela barbearia.',
  }));
}

async function searchLeadsWithAI({ city, neighborhood, country = 'Brasil', limit, profile }) {
  if (!config.openaiKey) {
    throw new Error('Configure OPENAI_API_KEY para a IA pesquisar leads na internet.');
  }

  const region = [neighborhood, city, country].filter(Boolean).join(', ');
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SEARCH_MODEL || 'gpt-4.1-mini',
      tools: [
        {
          type: 'web_search',
          search_context_size: 'medium',
          user_location: {
            type: 'approximate',
            country: 'BR',
            city,
            region: neighborhood || city,
          },
        },
      ],
      tool_choice: 'required',
      input: [
        {
          role: 'system',
          content:
            'Voce pesquisa leads B2B para vender um SaaS de agenda e gestao para barbearias. Use apenas dados encontrados na web. Nao invente telefone, endereco, Instagram, site ou link.',
        },
        {
          role: 'user',
          content: [
            `Pesquise na internet barbearias em ${region}.`,
            `Encontre ate ${limit} bons leads para vender o UltraBarber.`,
            `Perfil ideal: ${profile || 'barbearias com movimento, atendimento por WhatsApp e potencial para agenda marcada'}.`,
            'Priorize fontes como site oficial, Instagram, Google Maps/Perfil da Empresa quando aparecer nos resultados, listas locais e paginas publicas confiaveis.',
            'Retorne somente JSON valido, sem markdown, no formato:',
            '{"leads":[{"name":"string","phone":"string","neighborhood":"string","address":"string","instagram":"string","website":"string","googleMapsUri":"string","sourceUrl":"string","source":"string","score":80,"reason":"string","nextStep":"string"}]}',
            'Se algum campo nao for encontrado, use string vazia. Nao inclua leads sem nome.',
          ].join('\n'),
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `Falha na pesquisa web da IA (${response.status}).`);
  }

  const sources = getSources(data);
  const parsed = extractJson(getOutputText(data));
  const rawLeads = Array.isArray(parsed?.leads) ? parsed.leads : [];
  const normalized = rawLeads
    .map((lead, index) => normalizeLead(lead, index, sources[index]))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : buildFallbackFromSources(sources, limit);
}

function dedupePlaces(places) {
  const seen = new Set();
  return places.filter((place) => {
    const key = normalizeText(`${place.name}|${place.address}|${place.phone}|${place.sourceUrl}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function discoverLeads(params) {
  const limit = Math.min(Math.max(Number(params.limit || 12), 3), 20);
  const places = await searchLeadsWithAI({ ...params, limit });

  return dedupePlaces(places)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { discoverLeads, normalizeText };
