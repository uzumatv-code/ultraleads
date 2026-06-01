import { useEffect, useMemo, useState } from 'react';

const STATUSES = [
  'todos',
  'novo',
  'mensagem_enviada',
  'respondeu',
  'interessado',
  'reuniao_marcada',
  'recusou',
  'cliente',
];

function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selected, setSelected] = useState(null);
  const [suggestion, setSuggestion] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [notification, setNotification] = useState('');
  const [discoverForm, setDiscoverForm] = useState({
    city: '',
    neighborhood: '',
    profile: 'barbearias com agenda manual, fila de espera ou forte movimento por WhatsApp',
    limit: 8,
  });
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [importingId, setImportingId] = useState('');

  const filteredLeads = useMemo(
    () => (statusFilter === 'todos' ? leads : leads.filter((lead) => lead.status === statusFilter)),
    [leads, statusFilter]
  );

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      setLeads(data);
    } catch (err) {
      setNotification('Erro ao carregar leads.');
    } finally {
      setLoading(false);
    }
  };

  const openLead = async (lead) => {
    setSelected(lead);
    setSuggestion('');
    setMessage('');
    setPreviewText('');
    setHistory([]);
    try {
      const [suggest, historyData] = await Promise.all([
        fetch(`/api/leads/${lead.id}/followup`).then((res) => res.json()),
        fetch(`/api/messages/${lead.id}`).then((res) => res.json()),
      ]);
      if (suggest.eligible) setSuggestion(suggest.suggestion);
      setHistory(historyData);
    } catch (err) {
      console.error(err);
    }
  };

  const generateMessage = async () => {
    if (!selected) return;
    setNotification('Gerando mensagem...');
    try {
      const res = await fetch(`/api/messages/${selected.id}/generate`, { method: 'POST' });
      const data = await res.json();
      setMessage(data.message || '');
      setPreviewText(data.message || '');
      setNotification('Mensagem gerada. Revise e envie manualmente.');
    } catch (err) {
      setNotification('Erro ao gerar mensagem.');
    }
  };

  const sendWhatsApp = async () => {
    if (!selected || !previewText) return;
    if (!selected.phone) {
      setNotification('Valide o WhatsApp deste lead antes de enviar.');
      return;
    }
    setNotification('Enviando mensagem...');
    try {
      const res = await fetch(`/api/messages/${selected.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: previewText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha no envio');
      setNotification('Mensagem enviada com sucesso.');
      loadLeads();
      openLead(selected);
    } catch (err) {
      setNotification(err.message || 'Erro no envio do WhatsApp.');
    }
  };

  const discoverLeads = async (event) => {
    event.preventDefault();
    setDiscovering(true);
    setCandidates([]);
    setNotification('Buscando leads em fontes públicas e priorizando com IA...');
    try {
      const res = await fetch('/api/leads/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discoverForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na busca');
      setCandidates(data.candidates || []);
      setNotification(
        data.candidates?.length
          ? 'Leads encontrados. Revise os dados antes de importar.'
          : 'Nenhum candidato encontrado para esta região.'
      );
    } catch (err) {
      setNotification(err.message || 'Erro ao buscar novos leads.');
    } finally {
      setDiscovering(false);
    }
  };

  const importCandidate = async (candidate) => {
    setImportingId(candidate.externalId);
    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao importar lead');
      setNotification('Lead importado para o CRM.');
      setCandidates((current) =>
        current.map((item) => (item.externalId === candidate.externalId ? { ...item, duplicate: true } : item))
      );
      await loadLeads();
    } catch (err) {
      setNotification(err.message || 'Erro ao importar lead.');
    } finally {
      setImportingId('');
    }
  };

  return (
    <div>
      <header className="page-header">
        <h1>Leads</h1>
        <p>Gerencie as barbearias encontradas e envie mensagens de forma personalizada.</p>
      </header>

      <section className="card filter-bar">
        <label>
          Filtrar por status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === 'todos' ? 'Todos' : status.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card discovery-panel">
        <div className="section-heading">
          <div>
            <h2>Buscar novos leads com IA</h2>
            <p>Encontre barbearias em fontes públicas, priorize oportunidades e importe apenas o que fizer sentido.</p>
          </div>
        </div>
        <form className="discovery-form" onSubmit={discoverLeads}>
          <label>
            Cidade
            <input
              value={discoverForm.city}
              onChange={(event) => setDiscoverForm((current) => ({ ...current, city: event.target.value }))}
              placeholder="Ex.: São Paulo"
              required
            />
          </label>
          <label>
            Bairro
            <input
              value={discoverForm.neighborhood}
              onChange={(event) => setDiscoverForm((current) => ({ ...current, neighborhood: event.target.value }))}
              placeholder="Ex.: Pinheiros"
            />
          </label>
          <label>
            Quantidade
            <select
              value={discoverForm.limit}
              onChange={(event) => setDiscoverForm((current) => ({ ...current, limit: Number(event.target.value) }))}
            >
              {[5, 8, 12, 16].map((amount) => (
                <option key={amount} value={amount}>{amount}</option>
              ))}
            </select>
          </label>
          <label className="full-width">
            Perfil ideal
            <textarea
              value={discoverForm.profile}
              onChange={(event) => setDiscoverForm((current) => ({ ...current, profile: event.target.value }))}
              rows={3}
            />
          </label>
          <button type="submit" className="primary" disabled={discovering}>
            {discovering ? 'Buscando...' : 'Buscar leads'}
          </button>
        </form>

        {candidates.length > 0 && (
          <div className="candidate-list">
            {candidates.map((candidate) => (
              <article key={candidate.externalId} className="candidate-card">
                <div className="candidate-main">
                  <div>
                    <strong>{candidate.name}</strong>
                    <p>{candidate.address || candidate.neighborhood || 'Localização a validar'}</p>
                  </div>
                  <span className="score">{candidate.score}%</span>
                </div>
                <div className="candidate-data">
                  <span>{candidate.phone || 'WhatsApp a pesquisar'}</span>
                  <span>{candidate.instagram || candidate.website || 'Presença digital a validar'}</span>
                </div>
                <p>{candidate.reason}</p>
                <p className="muted">{candidate.nextStep}</p>
                <button
                  className={candidate.duplicate ? 'secondary' : 'primary'}
                  disabled={candidate.duplicate || importingId === candidate.externalId}
                  onClick={() => importCandidate(candidate)}
                >
                  {candidate.duplicate
                    ? 'Já está no CRM'
                    : importingId === candidate.externalId
                      ? 'Importando...'
                      : 'Importar lead'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {loading ? (
        <div className="card">Carregando leads...</div>
      ) : (
        <div className="grid lead-list">
          {filteredLeads.length === 0 ? (
            <div className="card">Nenhum lead encontrado neste filtro.</div>
          ) : (
            filteredLeads.map((lead) => (
              <div key={lead.id} className="card lead-card">
                <div>
                  <strong>{lead.name}</strong>
                  <p>{lead.phone || 'WhatsApp a validar'}</p>
                  <p>{lead.neighborhood || lead.address}</p>
                </div>
                <div className="lead-meta">
                  <span className={`status ${lead.status}`}>{lead.status.replace('_', ' ')}</span>
                  <button className="secondary" onClick={() => openLead(lead)}>
                    Detalhes
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selected && (
        <section className="card detail-panel">
          <h2>{selected.name}</h2>
          <div className="detail-grid">
            <div>
              <strong>WhatsApp</strong>
              <p>{selected.phone || 'A validar'}</p>
            </div>
            <div>
              <strong>Status</strong>
              <p>{selected.status.replace('_', ' ')}</p>
            </div>
            <div>
              <strong>Bairro</strong>
              <p>{selected.neighborhood || '—'}</p>
            </div>
            <div>
              <strong>Instagram</strong>
              <p>{selected.instagram || '—'}</p>
            </div>
          </div>

          <div className="action-row">
            <button className="primary" onClick={generateMessage}>
              Gerar mensagem personalizada
            </button>
          </div>

          {suggestion && (
            <div className="note">
              <strong>Follow-up sugerido:</strong>
              <p>{suggestion}</p>
            </div>
          )}

          <div className="card form-grid">
            <label className="full-width">
              Mensagem para WhatsApp
              <textarea
                value={previewText}
                onChange={(event) => setPreviewText(event.target.value)}
                rows={5}
              />
            </label>
            <div className="action-row">
              <button className="primary" onClick={sendWhatsApp} disabled={!previewText || !selected.phone}>
                Enviar WhatsApp
              </button>
            </div>
          </div>

          <div className="card">
            <h3>Histórico de mensagens</h3>
            {history.length === 0 ? (
              <p>Nenhuma mensagem enviada ainda.</p>
            ) : (
              <ul className="history-list">
                {history.map((item) => (
                  <li key={item.id}>
                    <span>{new Date(item.sent_at).toLocaleString()}</span>
                    <p>{item.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {notification && <div className="toast">{notification}</div>}
    </div>
  );
}

export default LeadsPage;
