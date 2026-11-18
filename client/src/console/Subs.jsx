import { useEffect, useState } from 'react';
import { formatDate } from '../api.js';

const STATUS = {
  pending: 'En attente',
  active: 'Actif',
  rejected: 'Refusé',
  expired: 'Expiré',
};

export default function Subs() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [notice, setNotice] = useState('');

  const load = () => {
    fetch('/api/admin/subscriptions', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setSubscriptions(data.subscriptions || []))
      .catch(() => {});
    fetch('/api/admin/authors', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setAuthors(data.authors || []))
      .catch(() => {});
  };

  useEffect(load, []);

  const act = async (path) => {
    setNotice('');
    try {
      const response = await fetch(path, { method: 'POST', credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Action impossible.');
      setNotice('Enregistré.');
      load();
    } catch (err) {
      setNotice(err.message);
    }
  };

  const pendingSubs = subscriptions.filter((s) => s.status === 'pending');
  const pendingAuthors = authors.filter((a) => a.author_status === 'pending');

  return (
    <div>
      {notice && <p className="ok">{notice}</p>}

      <h2>Abonnements en attente ({pendingSubs.length})</h2>
      <p className="hint">
        Vérifiez le transfert de 2 000 FCFA dans votre application Wave ou Orange Money, puis activez :
        30 jours d’accès à tout le catalogue.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lecteur</th>
              <th>Moyen</th>
              <th>Référence</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pendingSubs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Aucune demande en attente.
                </td>
              </tr>
            )}
            {pendingSubs.map((sub) => (
              <tr key={sub.id}>
                <td>
                  {sub.name || sub.email}
                  <br />
                  <span className="hint">{sub.email}</span>
                </td>
                <td>{sub.method === 'orange_money_direct' ? 'Orange Money' : 'Wave'}</td>
                <td>{sub.reference || '—'}</td>
                <td>{formatDate(sub.created_at)}</td>
                <td>
                  <button className="btn btn-gold btn-sm" onClick={() => act(`/api/admin/subscriptions/${sub.id}/validate`)}>
                    Activer 30 jours
                  </button>{' '}
                  <button className="btn btn-ghost btn-sm" onClick={() => act(`/api/admin/subscriptions/${sub.id}/reject`)}>
                    Refuser
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 32 }}>Demandes de statut auteur ({pendingAuthors.length})</h2>
      <p className="hint">Un auteur approuvé peut ouvrir l’atelier et rédiger ses romans en brouillon.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidat</th>
              <th>Nom de plume</th>
              <th>Projet</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pendingAuthors.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Aucune candidature en attente.
                </td>
              </tr>
            )}
            {pendingAuthors.map((author) => (
              <tr key={author.id}>
                <td>
                  {author.name || author.email}
                  <br />
                  <span className="hint">{author.email}</span>
                </td>
                <td>{author.pen_name || '—'}</td>
                <td style={{ maxWidth: 320 }}>{author.bio}</td>
                <td>
                  <button className="btn btn-gold btn-sm" onClick={() => act(`/api/admin/authors/${author.id}/approve`)}>
                    Approuver
                  </button>{' '}
                  <button className="btn btn-ghost btn-sm" onClick={() => act(`/api/admin/authors/${author.id}/reject`)}>
                    Refuser
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 32 }}>Historique des abonnements</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lecteur</th>
              <th>Statut</th>
              <th>Période</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.slice(0, 40).map((sub) => (
              <tr key={`h-${sub.id}`}>
                <td>{sub.email}</td>
                <td>{STATUS[sub.status] || sub.status}</td>
                <td>
                  {sub.period_start ? `${formatDate(sub.period_start)} → ${formatDate(sub.period_end)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
