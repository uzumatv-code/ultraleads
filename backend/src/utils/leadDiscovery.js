const config = require('../config');
const { getOpenAIClient } = require('./openaiClient');

const GOOGLE_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.types',
].join(',');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getAddressComponent(place, wantedTypes) {
  const components = place.addressComponents || [];
  const found = components.find((component) =>
    wantedTypes.some((type) => component.types?.includes(type))
  );
  return found?.longText || found?.shortText || '';
}

function normalizeGooglePlace(place) {
  const name = place.displayName?.text;
  if (!name) return null;

  const neighborhood = getAddressComponent(place, [
    'neighborhood',
    'sublocality',
    'sublocality_level_1',
    'administrative_area_level_3',
  ]);
  const city = getAddressComponent(place, ['locality', 'administrative_area_level_2']);
  const phone = place.nationalPhoneNumber || place.internationalPhoneNumber || '';

  return {
    externalId: `google/${place.id}`,
    name,
    phone,
    neighborhood,
    address: place.formattedAddress || [neighborhood, city].filter(Boolean).join(' - '),
    instagram: '',
    website: place.websiteUri || '',
    googleMapsUri: place.googleMapsUri || '',
    rating: place.rating || null,
    userRatingCount: place.userRatingCount || 0,
    businessStatus: place.businessStatus || '',
    source: 'Google Maps',
  };
}

function dedupePlaces(places) {
  const seen = new Set();
  return places.filter((place) => {
    const key = normalizeText(`${place.name}|${place.address}|${place.phone}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchGooglePlaces({ textQuery, pageSize }) {
  const response = await fetch(GOOGLE_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': config.googleMapsApiKey,
      'X-Goog-FieldMask': GOOGLE_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      pageSize,
      rankPreference: 'RELEVANCE',
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `Falha na busca do Google Places (${response.status}).`;
    throw new Error(message);
  }

  return (data.places || []).map(normalizeGooglePlace).filter(Boolean);
}

async function fetchBarbershopPlaces({ city, neighborhood, country = 'Brasil', limit = 20 }) {
  if (!config.googleMapsApiKey) {
    throw new Error('Configure GOOGLE_MAPS_API_KEY para buscar leads no Google Maps.');
  }

  const region = [neighborhood, city, country].filter(Boolean).join(', ');
  const queries = [
    `barbearia em ${region}`,
    `barber shop em ${region}`,
    `barbeiro em ${region}`,
    `barbearia agenda online em ${region}`,
  ];
  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 20);
  const results = [];

  for (const textQuery of queries) {
    results.push(...await searchGooglePlaces({ textQuery, pageSize }));
    if (dedupePlaces(results).length >= limit) break;
  }

  return dedupePlaces(results);
}

function buildFallbackRanking(places) {
  return places.map((place, index) => {
    const hasContact = Boolean(place.phone || place.website || place.googleMapsUri);
    const reviewSignal = Number(place.userRatingCount || 0);

    return {
      externalId: place.externalId,
      score: Math.min(95, Math.max(58, 88 - index * 3 + Math.min(reviewSignal, 100) / 20)),
      reason: hasContact
        ? 'Encontrado no Google Maps com dados de contato e presenca publica para validacao.'
        : 'Encontrado no Google Maps; exige validacao manual dos dados antes da abordagem.',
      nextStep: place.phone
        ? 'Validar se o telefone do perfil tambem atende WhatsApp antes de enviar mensagem.'
        : 'Abrir o perfil no Google Maps e confirmar WhatsApp, Instagram ou responsavel.',
    };
  });
}

async function rankPlacesWithAI({ places, city, neighborhood, profile }) {
  const openai = getOpenAIClient();
  if (!openai || places.length === 0) {
    return buildFallbackRanking(places);
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Voce e um analista de prospeccao B2B para um SaaS de agenda e atendimento para barbearias. Avalie somente os locais fornecidos; nao invente telefone, endereco ou redes sociais.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          objetivo:
            'Priorize barbearias encontradas no Google Maps/Perfil da Empresa que parecem boas candidatas para vender o UltraBarber.',
          cidade: city,
          bairro: neighborhood || null,
          perfilDesejado: profile || 'barbearias com fluxo de atendimento e potencial de agenda marcada',
          locais: places.map((place) => ({
            externalId: place.externalId,
            name: place.name,
            phone: place.phone,
            neighborhood: place.neighborhood,
            address: place.address,
            website: place.website,
            googleMapsUri: place.googleMapsUri,
            rating: place.rating,
            userRatingCount: place.userRatingCount,
            businessStatus: place.businessStatus,
          })),
        }),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'lead_ranking',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            leads: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  externalId: { type: 'string' },
                  score: { type: 'integer' },
                  reason: { type: 'string' },
                  nextStep: { type: 'string' },
                },
                required: ['externalId', 'score', 'reason', 'nextStep'],
              },
            },
          },
          required: ['leads'],
        },
      },
    },
    max_tokens: 1200,
  });

  try {
    const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{"leads":[]}');
    return Array.isArray(parsed.leads) ? parsed.leads : buildFallbackRanking(places);
  } catch (error) {
    console.warn('AI lead ranking parse failed:', error.message);
    return buildFallbackRanking(places);
  }
}

async function discoverLeads(params) {
  const limit = Math.min(Math.max(Number(params.limit || 12), 3), 20);
  const places = await fetchBarbershopPlaces({ ...params, limit: Math.max(limit * 2, 20) });
  const ranking = await rankPlacesWithAI({ ...params, places });
  const rankById = new Map(ranking.map((item) => [item.externalId, item]));

  return places
    .map((place) => {
      const rank = rankById.get(place.externalId);
      return {
        ...place,
        score: Math.min(Math.max(Number(rank?.score || 60), 0), 100),
        reason: rank?.reason || 'Encontrado no Google Maps; validar dados antes do contato.',
        nextStep: rank?.nextStep || 'Confirmar WhatsApp e responsavel antes de abordar.',
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { discoverLeads, normalizeText };
