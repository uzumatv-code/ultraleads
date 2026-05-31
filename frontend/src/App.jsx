import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import LeadsPage from './pages/LeadsPage';
import DashboardPage from './pages/DashboardPage';
import LeadForm from './pages/LeadForm';

function App() {
  const location = useLocation();
  const [settings, setSettings] = useState({ dailyLimit: 10 });

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">UltraBarber CRM</div>
        <nav>
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Dashboard</Link>
          <Link to="/leads" className={location.pathname.startsWith('/leads') ? 'active' : ''}>Leads</Link>
          <Link to="/new" className={location.pathname === '/new' ? 'active' : ''}>Novo lead</Link>
        </nav>
        <div className="sidebar-footer">
          <div>Limite diário: <strong>{settings.dailyLimit}</strong></div>
          <div>Envio manual e controlado</div>
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/new" element={<LeadForm />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
