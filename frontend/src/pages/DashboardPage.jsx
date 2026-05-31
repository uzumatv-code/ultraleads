import { useEffect, useState } from 'react';

function DashboardPage() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then(setMetrics)
      .catch(() => setMetrics(null));
  }, []);

  return (
    <div>
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>Visão geral da prospecção e performance de leads.</p>
      </header>
      {!metrics ? (
        <div className="card">Carregando métricas...</div>
      ) : (
        <div className="grid cards">
          <div className="card">
            <span>Total de leads</span>
            <strong>{metrics.totalLeads}</strong>
          </div>
          <div className="card">
            <span>Mensagens enviadas</span>
            <strong>{metrics.messagesSent}</strong>
          </div>
          <div className="card">
            <span>Respostas</span>
            <strong>{metrics.responses}</strong>
          </div>
          <div className="card">
            <span>Interessados</span>
            <strong>{metrics.interested}</strong>
          </div>
          <div className="card">
            <span>Reuniões marcadas</span>
            <strong>{metrics.meetings}</strong>
          </div>
          <div className="card">
            <span>Clientes fechados</span>
            <strong>{metrics.clients}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
