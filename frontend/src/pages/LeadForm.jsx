import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const initial = {
  name: '',
  phone: '',
  neighborhood: '',
  address: '',
  instagram: '',
  notes: '',
  status: 'novo',
};

function LeadForm() {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error('Não foi possível salvar.');
      navigate('/leads');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <h1>Novo lead</h1>
        <p>Cadastre a barbearia para começar a prospecção.</p>
      </header>
      <form className="card form-grid" onSubmit={handleSubmit}>
        <label>
          Nome da barbearia
          <input name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label>
          WhatsApp
          <input name="phone" value={form.phone} onChange={handleChange} required />
        </label>
        <label>
          Bairro
          <input name="neighborhood" value={form.neighborhood} onChange={handleChange} />
        </label>
        <label>
          Endereço
          <input name="address" value={form.address} onChange={handleChange} />
        </label>
        <label>
          Instagram
          <input name="instagram" value={form.instagram} onChange={handleChange} />
        </label>
        <label className="full-width">
          Observações
          <textarea name="notes" value={form.notes} onChange={handleChange} rows="4" />
        </label>
        <button type="submit" className="primary" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar lead'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}

export default LeadForm;
