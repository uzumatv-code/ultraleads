import { useEffect, useMemo, useState } from 'react';

const DEFAULT_PROFILES = {
  local_opportunity: {
    label: 'Oportunidade local',
    description: 'Abordagem proxima, dizendo que a barbearia foi notada na cidade e abrindo conversa como convite.',
    example:
      'Ola, {lead}! Vi a barbearia de voces em {place} e queria te apresentar uma oportunidade: estamos liberando o UltraBarber para barbearias da regiao, com agenda online, pagina propria de agendamento, apoio no Google, agenda para colaboradores e controle de comissoes. Faz sentido eu te mostrar rapidinho?',
  },
  management_consultant: {
    label: 'Consultivo de gestao',
    description: 'Foca nas dores do dono: agenda, equipe, comissoes, recorrencia e organizacao da operacao.',
    example:
      'Ola, {lead}. Estou falando com algumas barbearias em {place} sobre organizacao de agenda, equipe e comissoes. O UltraBarber centraliza agendamentos, pagina propria, colaboradores e controle da operacao. Hoje voces controlam isso por sistema ou mais pelo WhatsApp?',
  },
  direct_growth: {
    label: 'Direto para crescimento',
    description: 'Mensagem curta para gerar resposta rapida, destacando agenda online e posicionamento no Google.',
    example:
      'Ola, {lead}! Estamos ajudando barbearias de {place} a receber mais agendamentos com pagina propria, organizacao da agenda, presenca no Google e controle de comissoes. Posso te mandar uma previa de como ficaria para a sua barbearia?',
  },
};

function AiSettingsPage() {
  const [settings, setSettings] = useState({
    activeProfile: 'local_opportunity',
    customInstructions: '',
    profiles: DEFAULT_PROFILES,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    fetch('/api/ai-settings')
      .then((res) => res.json())
      .then((data) => setSettings({ ...data, profiles: data.profiles || DEFAULT_PROFILES }))
      .catch(() => setNotification('Erro ao carregar configuracao da IA.'))
      .finally(() => setLoading(false));
  }, []);

  const profiles = useMemo(() => Object.entries(settings.profiles || {}), [settings.profiles]);
  const activeProfile = settings.profiles?.[settings.activeProfile];

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotification('');

    try {
      const res = await fetch('/api/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeProfile: settings.activeProfile,
          customInstructions: settings.customInstructions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar');
      setSettings(data);
      setNotification('Configuracao da IA salva.');
    } catch (error) {
      setNotification(error.message || 'Erro ao salvar configuracao da IA.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <h1>Configuracao da IA</h1>
        <p>Controle a abordagem usada para gerar mensagens de prospeccao.</p>
      </header>

      {loading ? (
        <div className="card">Carregando configuracao...</div>
      ) : (
        <form className="ai-settings-layout" onSubmit={saveSettings}>
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Perfil de abordagem</h2>
                <p>Escolha como a IA deve posicionar o UltraBarber na primeira conversa.</p>
              </div>
            </div>

            <div className="profile-grid">
              {profiles.map(([key, profile]) => (
                <button
                  type="button"
                  key={key}
                  className={`profile-option ${settings.activeProfile === key ? 'selected' : ''}`}
                  onClick={() => setSettings((current) => ({ ...current, activeProfile: key }))}
                >
                  <span>{profile.label}</span>
                  <small>{profile.description}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="card form-grid">
            <div className="section-heading">
              <div>
                <h2>Ajuste fino</h2>
                <p>Use este campo para mudar o tom, oferta, cidade, promocao ou restricoes quando quiser.</p>
              </div>
            </div>

            <label className="full-width">
              Instrucoes extras para a IA
              <textarea
                value={settings.customInstructions || ''}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, customInstructions: event.target.value }))
                }
                rows={7}
                placeholder="Ex.: falar que estamos selecionando 5 barbearias da cidade para testar o sistema por 7 dias; evitar desconto; chamar para uma demonstracao rapida."
              />
            </label>

            {activeProfile && (
              <div className="message-preview">
                <strong>Exemplo do perfil ativo</strong>
                <p>
                  {activeProfile.example
                    .replace('{lead}', 'Barbearia Aguas Claras')
                    .replaceAll('{place}', 'Aguas Claras')}
                </p>
              </div>
            )}

            <div className="action-row">
              <button type="submit" className="primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar configuracao'}
              </button>
            </div>
          </section>
        </form>
      )}

      {notification && <div className="toast">{notification}</div>}
    </div>
  );
}

export default AiSettingsPage;
