import { useEffect, useState } from 'react';
import { api, formatDate, formatXof, METHOD_LABELS, STATUS_LABELS } from '../api.js';

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.admin
      .stats()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <p className="muted">Chargement…</p>;

  const providers = [
    ['Wave (lien marchand)', data.providers.wave],
    ['Orange Money (numéro)', data.providers.orange],
    ['Wave API', data.providers.waveApi],
    ['Orange Money API', data.providers.orangeApi],
    ['Envoi des e-mails', data.providers.email],
  ];

  const volatile = data.storage && data.storage.persistent === false;

  return (
    <>
      {volatile && (
        <div className="alert error" style={{ marginBottom: 18 }}>
          <strong>Données non persistantes.</strong> Cette instance gratuite efface comptes lecteurs et achats à
          chaque redémarrage. Validez un paiement en connaissance de cause, et exportez le CSV des ventes après
          chaque encaissement.
        </div>
      )}
      <div className="console-head">
        <div>
          <span className="eyebrow">Vue d’ensemble</span>
          <h1>Tableau de bord</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('orders')}>
            Paiements à traiter ({data.counts.pendingOrders})
          </button>
          <button type="button" className="btn btn-gold btn-sm" onClick={() => onNavigate('books')}>
            Publier un chapitre
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span>Revenus encaissés</span>
          <strong>{formatXof(data.revenueXof)}</strong>
        </div>
        <div className="stat">
          <span>Ventes confirmées</span>
          <strong>{data.sales}</strong>
          <span style={{ textTransform: 'none', letterSpacing: 0 }}>
            {data.breakdown
              ? `${data.breakdown.chapters.sales} ch. · ${data.breakdown.subscriptions.sales} formules · ${data.breakdown.packs.sales} packs`
              : ''}
          </span>
        </div>
        <div className="stat">
          <span>30 derniers jours</span>
          <strong>{formatXof(data.last30.revenueXof)}</strong>
          <span style={{ textTransform: 'none', letterSpacing: 0 }}>{data.last30.sales} ventes</span>
        </div>
        <div className="stat">
          <span>Lecteurs inscrits</span>
          <strong>{data.counts.readers}</strong>
        </div>
        <div className="stat">
          <span>À valider</span>
          <strong>{(data.counts.pendingOrders || 0) + (data.counts.pendingSubs || 0) + (data.counts.pendingPacks || 0)}</strong>
          <span style={{ textTransform: 'none', letterSpacing: 0 }}>
            {data.counts.pendingOrders || 0} achats · {data.counts.pendingSubs || 0} formules ·{' '}
            {data.counts.pendingPacks || 0} packs
          </span>
        </div>
        <div className="stat">
          <span>Chapitres en ligne</span>
          <strong>
            {data.counts.chaptersWithText}/{data.counts.chapters}
          </strong>
          <span style={{ textTransform: 'none', letterSpacing: 0 }}>avec texte</span>
        </div>
        <div className="stat">
          <span>Cœurs</span>
          <strong>{Number(data.counts.likes || 0).toLocaleString('fr-FR')}</strong>
          <span style={{ textTransform: 'none', letterSpacing: 0 }}>réactions des lecteurs</span>
        </div>
        <div className="stat">
          <span>Partages</span>
          <strong>{Number(data.counts.shares || 0).toLocaleString('fr-FR')}</strong>
          <span style={{ textTransform: 'none', letterSpacing: 0 }}>
            dont {data.audience?.sharesToday || 0} aujourd’hui
          </span>
        </div>
        <div className="stat">
          <span>Messages non lus</span>
          <strong>{data.counts.newMessages}</strong>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <h2 style={{ fontSize: '1.2rem', marginBottom: 12 }}>Dernières commandes</h2>
          {data.recent.length === 0 ? (
            <p className="empty">Aucune commande pour le moment.</p>
          ) : (
            data.recent.map((order) => (
              <div className="row-item" key={order.reference}>
                <div className="grow">
                  <strong>
                    {order.book_title} — ch. {order.chapter_number}
                  </strong>
                  <span>
                    {order.reference} · {METHOD_LABELS[order.method]} · {formatXof(order.amount_xof)} ·{' '}
                    {formatDate(order.created_at)}
                  </span>
                </div>
                <span className={`pill ${order.status === 'paid' ? 'free' : order.status === 'pending' ? '' : 'warn'}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <h2 style={{ fontSize: '1.2rem', marginBottom: 12 }}>Prestataires</h2>
          {providers.map(([label, ok]) => (
            <div className="row-item" key={label}>
              <div className="grow">
                <strong>{label}</strong>
                <span>{ok ? 'configuré' : 'non configuré'}</span>
              </div>
              <span className={`pill ${ok ? 'free' : 'dark'}`}>{ok ? 'Actif' : 'Inactif'}</span>
            </div>
          ))}
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 12 }}>
            Les encaissements Wave et Orange Money se font hors plateforme : la validation se fait dans l’onglet
            Ventes après vérification du relevé.
          </p>
        </div>
      </div>
    </>
  );
}
