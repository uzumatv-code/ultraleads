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
                  <p>{lead.phone}</p>
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
              <p>{selected.phone}</p>
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
              <button className="primary" onClick={sendWhatsApp} disabled={!previewText}>
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
