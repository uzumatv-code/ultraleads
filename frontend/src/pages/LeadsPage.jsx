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

const EDITABLE_STATUSES = STATUSES.filter((status) => status !== 'todos');

function buildLeadForm(lead = {}) {
  return {
    name: lead.name || '',
    phone: lead.phone || '',
    neighborhood: lead.neighborhood || '',
    address: lead.address || '',
    instagram: lead.instagram || '',
    notes: lead.notes || '',
    status: lead.status || 'novo',
    last_contact_date: lead.last_contact_date || '',
  };
}

function formatStatus(status) {
  return String(status || 'novo').replace('_', ' ');
}

function getGoogleMapsUrl(lead) {
  const notesUrl = String(lead.notes || '').match(/https?:\/\/[^\s]+/i)?.[0];
  if (notesUrl) return notesUrl;
  const query = [lead.name, lead.address, lead.neighborhood].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function getInstagramUrl(instagram) {
  if (!instagram) return '';
  if (/^https?:\/\//i.test(instagram)) return instagram;
  return `https://instagram.com/${String(instagram).replace('@', '').trim()}`;
}

function getWhatsAppUrl(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const normalized = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${normalized}`;
}

function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selected, setSelected] = useState(null);
  const [detailMode, setDetailMode] = useState('view');
  const [suggestion, setSuggestion] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [editForm, setEditForm] = useState(buildLeadForm());
  const [savingLead, setSavingLead] = useState(false);
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
  const leadStats = useMemo(() => ({
    total: leads.length,
    interessados: leads.filter((lead) => lead.status === 'interessado').length,
    respostas: leads.filter((lead) => ['respondeu', 'interessado', 'reuniao_marcada'].includes(lead.status)).length,
    clientes: leads.filter((lead) => lead.status === 'cliente').length,
  }), [leads]);

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

  const openLead = async (lead, mode = 'view') => {
    setSelected(lead);
    setDetailMode(mode);
    setSuggestion('');
    setMessage('');
    setPreviewText('');
    setHistory([]);
    setEditForm(buildLeadForm(lead));
    try {
      const [suggest, historyData] = await Promise.all([
        fetch(`/api/leads/${lead.id}/followup`).then((res) => res.json()),
        fetch(`/api/messages/${lead.id}`).then((res) => res.json()),
      ]);
      if (suggest.eligible) setSuggestion(suggest.suggestion);
      const aiSuggestion = historyData.find((item) => item.direction === 'suggested');
      if (aiSuggestion) setSuggestion(`Resposta sugerida pela IA: ${aiSuggestion.content}`);
      setHistory(historyData);
    } catch (err) {
      console.error(err);
    }
  };

  const openLeadExternal = (lead) => {
    const url = getWhatsAppUrl(lead.phone) || getInstagramUrl(lead.instagram) || getGoogleMapsUrl(lead);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const closeLeadModal = () => {
    setSelected(null);
    setDetailMode('view');
    setSuggestion('');
    setMessage('');
    setPreviewText('');
    setHistory([]);
  };

  const saveLead = async (event) => {
    event.preventDefault();
    if (!selected) return;

    setSavingLead(true);
    setNotification('Salvando lead...');
    try {
      const res = await fetch(`/api/leads/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar lead');

      setSelected(data);
      setEditForm(buildLeadForm(data));
      setLeads((current) => current.map((lead) => (lead.id === data.id ? data : lead)));
      setNotification('Dados do lead atualizados.');
    } catch (err) {
      setNotification(err.message || 'Erro ao salvar lead.');
    } finally {
      setSavingLead(false);
    }
  };

  const deleteLead = async (lead) => {
    const confirmed = window.confirm(`Excluir ${lead.name}? Esta acao remove o lead e o historico de mensagens.`);
    if (!confirmed) return;

    setNotification('Excluindo lead...');
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao excluir lead');

      setLeads((current) => current.filter((item) => item.id !== lead.id));
      if (selected?.id === lead.id) {
        setSelected(null);
        setHistory([]);
        setPreviewText('');
      }
      setNotification('Lead excluido.');
    } catch (err) {
      setNotification(err.message || 'Erro ao excluir lead.');
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
    setNotification('A IA esta pesquisando leads na internet...');
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

      <section className="lead-stats">
        <div>
          <span>Total</span>
          <strong>{leadStats.total}</strong>
        </div>
        <div>
          <span>Respostas</span>
          <strong>{leadStats.respostas}</strong>
        </div>
        <div>
          <span>Interessados</span>
          <strong>{leadStats.interessados}</strong>
        </div>
        <div>
          <span>Clientes</span>
          <strong>{leadStats.clientes}</strong>
        </div>
      </section>

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
            <p>A IA pesquisa na internet, cruza fontes publicas e importa apenas o que fizer sentido.</p>
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
                  <span>{candidate.sourceUrl || candidate.googleMapsUri || candidate.website || 'Fonte web a validar'}</span>
                  {candidate.rating && (
                    <span>{candidate.rating} estrelas · {candidate.userRatingCount || 0} avaliacoes</span>
                  )}
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
        <section className="lead-table card">
          {filteredLeads.length === 0 ? (
            <div className="empty-state">Nenhum lead encontrado neste filtro.</div>
          ) : (
            <>
              <div className="lead-table-header">
                <span>Lead</span>
                <span>Status</span>
                <span>Contato</span>
                <span>Local</span>
                <span>Acoes</span>
              </div>
              <div className="lead-table-body">
                {filteredLeads.map((lead) => (
                  <article key={lead.id} className={`lead-row ${selected?.id === lead.id ? 'selected' : ''}`}>
                    <div className="lead-name-cell">
                      <strong>{lead.name}</strong>
                      <small>{lead.notes ? 'Com observacoes' : 'Sem observacoes'}</small>
                    </div>
                    <div>
                      <span className={`status ${lead.status}`}>{formatStatus(lead.status)}</span>
                    </div>
                    <div className="lead-muted-cell">
                      <span>{lead.phone || 'WhatsApp a validar'}</span>
                      <small>{lead.instagram || 'Instagram nao informado'}</small>
                    </div>
                    <div className="lead-muted-cell">
                      <span>{lead.neighborhood || 'Bairro a validar'}</span>
                      <small>{lead.address || 'Endereco nao informado'}</small>
                    </div>
                    <div className="lead-actions">
                      <button className="secondary compact" onClick={() => openLead(lead, 'view')}>Ver</button>
                      <button className="secondary compact" onClick={() => openLeadExternal(lead)}>Abrir</button>
                      <button className="secondary compact" onClick={() => openLead(lead, 'edit')}>Editar</button>
                      <button className="danger compact" onClick={() => deleteLead(lead)}>Excluir</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {selected && (
        <section className="card detail-panel">
          <div className="modal-header">
            <div>
              <span className={`status ${selected.status}`}>{formatStatus(selected.status)}</span>
              <h2>{selected.name}</h2>
              <p>{selected.neighborhood || selected.address || 'Localizacao a validar'}</p>
            </div>
            <button className="icon-button" onClick={closeLeadModal} aria-label="Fechar modal">×</button>
          </div>
          <div className="modal-tabs">
            <button className={detailMode === 'view' ? 'active' : ''} onClick={() => setDetailMode('view')}>
              Visao geral
            </button>
            <button className={detailMode === 'edit' ? 'active' : ''} onClick={() => setDetailMode('edit')}>
              Editar
            </button>
          </div>
          {detailMode === 'view' ? (
            <div className="lead-summary">
              <div>
                <span>Status</span>
                <strong className={`status ${selected.status}`}>{formatStatus(selected.status)}</strong>
              </div>
              <div>
                <span>WhatsApp</span>
                <strong>{selected.phone || 'A validar'}</strong>
              </div>
              <div>
                <span>Bairro</span>
                <strong>{selected.neighborhood || 'A validar'}</strong>
              </div>
              <div>
                <span>Endereco</span>
                <strong>{selected.address || 'Nao informado'}</strong>
              </div>
              <div>
                <span>Instagram</span>
                <strong>{selected.instagram || 'Nao informado'}</strong>
              </div>
              <div className="full-width">
                <span>Observacoes</span>
                <p>{selected.notes || 'Nenhuma observacao cadastrada.'}</p>
              </div>
              <div className="action-row full-width">
                <button className="secondary" onClick={() => openLeadExternal(selected)}>Abrir lead</button>
                <button className="primary" onClick={() => setDetailMode('edit')}>Editar lead</button>
              </div>
            </div>
          ) : (
            <form className="lead-edit-form" onSubmit={saveLead}>
            <label>
              Nome
              <input
                value={editForm.name}
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label>
              WhatsApp
              <input
                value={editForm.phone}
                onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Telefone ou WhatsApp"
              />
            </label>
            <label>
              Status
              <select
                value={editForm.status}
                onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
              >
                {EDITABLE_STATUSES.map((status) => (
                  <option key={status} value={status}>{status.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
            <label>
              Bairro
              <input
                value={editForm.neighborhood}
                onChange={(event) => setEditForm((current) => ({ ...current, neighborhood: event.target.value }))}
              />
            </label>
            <label className="wide-field">
              Endereco
              <input
                value={editForm.address}
                onChange={(event) => setEditForm((current) => ({ ...current, address: event.target.value }))}
              />
            </label>
            <label>
              Instagram
              <input
                value={editForm.instagram}
                onChange={(event) => setEditForm((current) => ({ ...current, instagram: event.target.value }))}
              />
            </label>
            <label className="full-width">
              Observacoes
              <textarea
                value={editForm.notes}
                onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
                rows={4}
              />
            </label>
            <div className="action-row full-width">
              <button type="submit" className="primary" disabled={savingLead}>
                {savingLead ? 'Salvando...' : 'Salvar dados do lead'}
              </button>
            </div>
            </form>
          )}

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
            <h3>Historico de mensagens</h3>
            {history.length === 0 ? (
              <p>Nenhuma mensagem enviada ainda.</p>
            ) : (
              <ul className="history-list">
                {history.map((item) => (
                  <li key={item.id} className={`history-${item.direction}`}>
                    <span>
                      <strong>
                        {item.direction === 'sent'
                          ? 'Enviada'
                          : item.direction === 'received'
                            ? 'Recebida'
                            : 'Sugestao IA'}
                      </strong>
                      {new Date(item.sent_at).toLocaleString()}
                    </span>
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
