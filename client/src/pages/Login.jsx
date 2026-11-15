import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../session.jsx';

export default function Login() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/compte';
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(form);
      navigate(user.role === 'admin' && next === '/compte' ? '/console' : next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <form className="form-card" onSubmit={submit}>
        <h1>Connexion</h1>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          Retrouvez vos chapitres débloqués et votre progression.
        </p>
        {error && <div className="alert error">{error}</div>}
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
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <button type="submit" className="btn btn-gold btn-block" disabled={busy}>
          {busy ? 'Connexion…' : 'Entrer'}
        </button>
        <p className="muted center" style={{ marginTop: 16, fontSize: '0.86rem' }}>
          Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
        </p>
      </form>
    </div>
  );
}
