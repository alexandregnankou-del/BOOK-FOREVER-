import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../session.jsx';

export default function Register() {
  const { register } = useSession();
  const navigate = useNavigate();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    ref: (params?.get('ref') || '').toUpperCase(),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(form);
      navigate('/compte');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <form className="form-card" onSubmit={submit}>
        <h1>Créer un compte</h1>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          Gratuit. Nécessaire seulement pour débloquer un chapitre et conserver vos achats.
        </p>
        {error && <div className="alert error">{error}</div>}
        <div className="field">
          <label htmlFor="name">Nom affiché</label>
          <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="email">Adresse e-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe (8 caractères minimum)</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="ref">Code de parrainage (facultatif)</label>
          <input
            id="ref"
            value={form.ref}
            onChange={(e) => setForm({ ...form, ref: e.target.value.toUpperCase() })}
            maxLength={12}
            placeholder="Ex. 8F3A1C2B"
          />
          <span className="hint">Un ami vous a invité ? Son code lui offre un chapitre.</span>
        </div>
        <button type="submit" className="btn btn-gold btn-block" disabled={busy}>
          {busy ? 'Création…' : 'Créer mon compte'}
        </button>
        <p className="muted center" style={{ marginTop: 16, fontSize: '0.86rem' }}>
          Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
        </p>
      </form>
    </div>
  );
}
