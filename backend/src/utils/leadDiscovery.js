const { getOpenAIClient } = require('./openaiClient');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

function escapeOverpassValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function extractAddress(tags = {}) {
  const street = tags['addr:street'];
  const number = tags['addr:housenumber'];
  const suburb = tags['addr:suburb'] || tags['addr:neighbourhood'];
  const city = tags['addr:city'];
  return [street && number ? `${street}, ${number}` : street, suburb, city].filter(Boolean).join(' - ');
}

function normalizePlace(element) {
  const tags = element.tags || {};
  const name = tags.name || tags.brand || tags.operator;
  if (!name) return null;

  const social =
    tags['contact:instagram'] ||
    tags.instagram ||
    tags['contact:facebook'] ||
    tags.facebook ||
    '';

  return {
    externalId: `${element.type}/${element.id}`,
    name,
    phone: tags.phone || tags['contact:phone'] || tags.mobile || tags['contact:mobile'] || '',
    neighborhood: tags['addr:suburb'] || tags['addr:neighbourhood'] || '',
    address: extractAddress(tags),
    instagram: social,
    website: tags.website || tags['contact:website'] || '',
    source: 'OpenStreetMap',
  };
}

function normalizeNominatimPlace(place) {
  const address = place.address || {};
  const extra = place.extratags || {};
  const name = place.name || address.shop || address.amenity;
  if (!name) return null;

  const street = address.road;
  const number = address.house_number;
  return {
    externalId: `${place.osm_type}/${place.osm_id}`,
    name,
    phone: extra.phone || extra['contact:phone'] || '',
    neighborhood: address.suburb || address.city_district || address.neighbourhood || '',
    address: [street && number ? `${street}, ${number}` : street, address.suburb, address.city].filter(Boolean).join(' - '),
    instagram: extra.instagram || extra['contact:instagram'] || '',
    website: extra.website || extra['contact:website'] || '',
    source: 'OpenStreetMap',
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

async function fetchBarbershopPlaces({ city, neighborhood, country = 'Brasil', limit = 20 }) {
  const textPlaces = await fetchPlacesByText({ city, neighborhood, country, limit });
  if (textPlaces.length > 0) return textPlaces;

  const areaName = escapeOverpassValue(neighborhood || city);
  const cityName = escapeOverpassValue(city);
  const query = `
    [out:json][timeout:25];
    (
      area["name"="${areaName}"]["boundary"="administrative"];
      area["name"="${cityName}"]["boundary"="administrative"];
    )->.searchArea;
    (
      nwr["shop"="hairdresser"]["name"](area.searchArea);
      nwr["shop"="beauty"]["name"~"barbearia|barber|barbershop|barbeiro",i](area.searchArea);
      nwr["name"~"barbearia|barber|barbershop|barbeiro",i](area.searchArea);
    );
    out tags center ${Number(limit) || 20};
  `;

  const response = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'UltraLeads/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha na busca pública de lugares (${response.status}).`);
  }

  const data = await response.json();
  const areaPlaces = dedupePlaces((data.elements || []).map(normalizePlace).filter(Boolean));
  if (areaPlaces.length > 0) return dedupePlaces([...textPlaces, ...areaPlaces]);

  const coordinates = await fetchCoordinates([neighborhood, city, country].filter(Boolean).join(', '));
  if (!coordinates) return textPlaces;

  const aroundPlaces = await fetchPlacesAroundCoordinates({ ...coordinates, limit });
  return dedupePlaces([...textPlaces, ...aroundPlaces]);
}

async function fetchPlacesByText({ city, neighborhood, country, limit }) {
  const region = [neighborhood, city, country].filter(Boolean).join(' ');
  const queries = [`barbearia ${region}`, `barber shop ${region}`];
  const results = [];

  for (const query of queries) {
    const url = `${NOMINATIM_URL}?format=json&limit=${Number(limit) || 20}&addressdetails=1&extratags=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'UltraLeads/1.0',
      },
    });

    if (response.ok) {
      const data = await response.json();
      results.push(...(data || []).map(normalizeNominatimPlace).filter(Boolean));
    }
  }

  return dedupePlaces(results);
}

async function fetchCoordinates(query) {
  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'UltraLeads/1.0',
    },
  });

  if (!response.ok) return null;
  const data = await response.json();
  const first = data[0];
  if (!first?.lat || !first?.lon) return null;
  return { lat: Number(first.lat), lon: Number(first.lon) };
}

async function fetchPlacesAroundCoordinates({ lat, lon, limit }) {
  const radius = 6000;
  const query = `
    [out:json][timeout:25];
    (
      node["shop"="hairdresser"]["name"](around:${radius},${lat},${lon});
      way["shop"="hairdresser"]["name"](around:${radius},${lat},${lon});
      relation["shop"="hairdresser"]["name"](around:${radius},${lat},${lon});
      node["shop"="beauty"]["name"~"barbearia|barber|barbershop|barbeiro",i](around:${radius},${lat},${lon});
      way["shop"="beauty"]["name"~"barbearia|barber|barbershop|barbeiro",i](around:${radius},${lat},${lon});
      relation["shop"="beauty"]["name"~"barbearia|barber|barbershop|barbeiro",i](around:${radius},${lat},${lon});
      node["name"~"barbearia|barber|barbershop|barbeiro",i](around:${radius},${lat},${lon});
      way["name"~"barbearia|barber|barbershop|barbeiro",i](around:${radius},${lat},${lon});
      relation["name"~"barbearia|barber|barbershop|barbeiro",i](around:${radius},${lat},${lon});
    );
    out tags center ${Number(limit) || 20};
  `;

  const response = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'UltraLeads/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha na busca pública por coordenadas (${response.status}).`);
  }

  const data = await response.json();
  return dedupePlaces((data.elements || []).map(normalizePlace).filter(Boolean));
}

function buildFallbackRanking(places) {
  return places.map((place, index) => ({
    externalId: place.externalId,
    score: Math.max(55, 90 - index * 4),
    reason: place.phone || place.instagram || place.website
      ? 'Possui dados públicos de contato ou presença digital para validação rápida.'
      : 'Aparece em fonte pública de lugares e deve ser validado antes do contato.',
    nextStep: place.phone
      ? 'Validar se o WhatsApp ainda pertence à barbearia antes de enviar mensagem.'
      : 'Pesquisar WhatsApp no Google, Instagram ou Maps antes de abordar.',
  }));
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
          'Você é um analista de prospecção B2B para um SaaS de agenda e atendimento para barbearias. Avalie somente os locais fornecidos; não invente telefone, endereço ou redes sociais.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          objetivo:
            'Priorize barbearias que parecem boas candidatas para vender um SaaS chamado UltraBarber.',
          cidade: city,
          bairro: neighborhood || null,
          perfilDesejado: profile || 'barbearias com fluxo de atendimento e potencial de agenda marcada',
          locais: places.map((place) => ({
            externalId: place.externalId,
            name: place.name,
            phone: place.phone,
            neighborhood: place.neighborhood,
            address: place.address,
            instagram: place.instagram,
            website: place.website,
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
        reason: rank?.reason || 'Encontrado em fonte pública de lugares; validar dados antes do contato.',
        nextStep: rank?.nextStep || 'Confirmar WhatsApp e responsável antes de abordar.',
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { discoverLeads, normalizeText };
