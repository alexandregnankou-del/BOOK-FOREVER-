import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../session.jsx';
import Dashboard from '../console/Dashboard.jsx';
import Books from '../console/Books.jsx';
import Messages from '../console/Messages.jsx';
import Orders from '../console/Orders.jsx';
import Subs from '../console/Subs.jsx';
import Settings from '../console/Settings.jsx';
import { api } from '../api.js';

const TABS = [
  ['dashboard', 'Tableau de bord'],
  ['books', 'Romans & chapitres'],
  ['messages', 'Messages'],
  ['orders', 'Ventes'],
  ['subs', 'Abonnements & auteurs'],
  ['settings', 'Réglages'],
];

export default function Console() {
  const { user, ready, logout } = useSession();
  const [tab, setTab] = useState('dashboard');
  const [badges, setBadges] = useState({ orders: 0, messages: 0 });

  useEffect(() => {
    document.title = 'Console — BOOK FOREVER';
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    api.admin
      .stats()
      .then((data) => setBadges({ orders: data.counts.pendingOrders, messages: data.counts.newMessages }))
      .catch(() => {});
  }, [user, tab]);

  if (!ready) return <p className="empty">Vérification de la session…</p>;

  if (!user || user.role !== 'admin') {
    return (
      <div className="wrap">
        <div className="form-card">
          <h1>Console réservée</h1>
          <p className="muted">
            Cette page est l’espace de travail de l’éditeur. Connectez-vous avec le compte administrateur.
          </p>
          <Link to="/connexion?next=/console" className="btn btn-gold btn-block">
            Se connecter
          </Link>
          <p className="muted center" style={{ marginTop: 14, fontSize: '0.84rem' }}>
            <Link to="/">Retour au site</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="console">
      <aside className="console-nav">
        <div className="brand">BOOK FOREVER</div>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
            {id === 'orders' && badges.orders > 0 && ` (${badges.orders})`}
            {id === 'messages' && badges.messages > 0 && ` (${badges.messages})`}
          </button>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 20, fontSize: '0.78rem', opacity: 0.75 }}>
          <div style={{ padding: '0 12px 8px' }}>{user.email}</div>
          <Link to="/" style={{ padding: '8px 12px' }}>
            ← Voir le site
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.href = '/';
            }}
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="console-main">
        {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
        {tab === 'books' && <Books />}
        {tab === 'messages' && <Messages />}
        {tab === 'orders' && <Orders />}
        {tab === 'subs' && <Subs />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
