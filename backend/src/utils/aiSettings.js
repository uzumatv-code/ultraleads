const AI_PROFILES = {
  local_opportunity: {
    label: 'Oportunidade local',
    description: 'Abordagem proxima, dizendo que a barbearia foi notada na cidade e abrindo conversa como convite.',
    prompt:
      'Abra dizendo que notamos a barbearia na cidade/regiao. Posicione como uma oportunidade de conhecer um sistema criado com feedback de outras barbearias. Cite de forma natural pagina de agendamento personalizada, organizacao da agenda, presenca no Google, acesso dos colaboradores e controle de comissoes. Nao soe como spam.',
    example:
      'Ola, {lead}! Vi a barbearia de voces em {place} e queria te apresentar uma oportunidade: estamos liberando o UltraBarber para barbearias da regiao, com agenda online, pagina propria de agendamento, apoio no Google, agenda para colaboradores e controle de comissoes. Faz sentido eu te mostrar rapidinho?',
  },
  management_consultant: {
    label: 'Consultivo de gestao',
    description: 'Foca nas dores do dono: agenda, equipe, comissoes, recorrencia e organizacao da operacao.',
    prompt:
      'Aborde como consultor de gestao. Mostre que o sistema ajuda a organizar a barbearia por completo: agenda, equipe, comissoes, historico de clientes, pagina de agendamento e acompanhamento do movimento. Faca uma pergunta diagnostica no final.',
    example:
      'Ola, {lead}. Estou falando com algumas barbearias em {place} sobre organizacao de agenda, equipe e comissoes. O UltraBarber centraliza agendamentos, pagina propria, colaboradores e controle da operacao. Hoje voces controlam isso por sistema ou mais pelo WhatsApp?',
  },
  direct_growth: {
    label: 'Direto para crescimento',
    description: 'Mensagem curta para gerar resposta rapida, destacando agenda online e posicionamento no Google.',
    prompt:
      'Seja curto, objetivo e comercial. Destaque crescimento, agenda online personalizada, menos espera, melhor presenca no Google e controle simples da barbearia. Termine com uma pergunta facil de responder.',
    example:
      'Ola, {lead}! Estamos ajudando barbearias de {place} a receber mais agendamentos com pagina propria, organizacao da agenda, presenca no Google e controle de comissoes. Posso te mandar uma previa de como ficaria para a sua barbearia?',
  },
};

const DEFAULT_AI_SETTINGS = {
  activeProfile: 'local_opportunity',
  customInstructions: '',
};

function normalizeProfile(profile) {
  return AI_PROFILES[profile] ? profile : DEFAULT_AI_SETTINGS.activeProfile;
}

async function getAiSettings(pool) {
  const [rows] = await pool.query('SELECT * FROM ai_settings WHERE id = 1');
  const settings = rows[0];

  if (!settings) {
    await pool.query(
      'INSERT INTO ai_settings (id, active_profile, custom_instructions) VALUES (1, ?, ?)',
      [DEFAULT_AI_SETTINGS.activeProfile, DEFAULT_AI_SETTINGS.customInstructions]
    );
    return DEFAULT_AI_SETTINGS;
  }

  return {
    activeProfile: normalizeProfile(settings.active_profile),
    customInstructions: settings.custom_instructions || '',
  };
}

function formatProfileExample(example, lead) {
  const place = lead.neighborhood || lead.address || 'sua regiao';
  return example.replace('{lead}', lead.name).replaceAll('{place}', place);
}

function buildMessagePrompt(lead, settings) {
  const activeProfile = normalizeProfile(settings.activeProfile);
  const profile = AI_PROFILES[activeProfile];
  const place = lead.neighborhood || lead.address || 'a regiao';
  const customInstructions = String(settings.customInstructions || '').trim();

  return [
    `Escreva uma mensagem de WhatsApp para a barbearia "${lead.name}", localizada em "${place}".`,
    `Perfil de abordagem: ${profile.label}.`,
    profile.prompt,
    'A mensagem deve ser personalizada, natural, sem tom generico de SaaS, sem parecer disparo em massa e com convite claro para conversa.',
    'Mantenha entre 350 e 650 caracteres, com no maximo dois paragrafos curtos.',
    customInstructions ? `Instrucoes extras do usuario: ${customInstructions}` : '',
  ].filter(Boolean).join('\n');
}

function getFallbackMessage(lead, settings) {
  const activeProfile = normalizeProfile(settings.activeProfile);
  return formatProfileExample(AI_PROFILES[activeProfile].example, lead);
}

module.exports = {
  AI_PROFILES,
  DEFAULT_AI_SETTINGS,
  buildMessagePrompt,
  getAiSettings,
  getFallbackMessage,
  normalizeProfile,
};
