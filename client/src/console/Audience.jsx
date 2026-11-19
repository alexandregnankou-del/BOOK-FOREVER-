import { useEffect, useState } from 'react';
import { api } from '../api.js';

/**
 * Audience : ce que les lecteurs font vraiment — vues, cœurs, partages,
 * abonnés. Les partages sont comptés quand le lecteur diffuse le lien
 * (WhatsApp, Telegram, Facebook, X, copie, menu du téléphone).
 */
const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  facebook: 'Facebook',
  x: 'X / Twitter',
  copie: 'Lien copié',
  native: 'Menu du téléphone',
  email: 'E-mail',
  autre: 'Autre',
};

export default function Audience() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.admin
      .audience()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <p className="muted">Chargement…</p>;

  const maxShares = Math.max(1, ...data.byChannel.map((c) => c.n));
  const maxDay = Math.max(1, ...data.daily.map((d) => d.n));

  return (
    <>
      <div className="console-head">
        <div>
          <span className="eyebrow">Diffusion</span>
          <h1>Audience</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.86rem' }}>
            Les partages mesurent la publicité faite par vos lecteurs. Un même lecteur qui repartage le même
            roman le même jour ne compte qu’une fois.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span>Vues</span>
          <strong>{Number(data.totals.views || 0).toLocaleString('fr-FR')}</strong>
          <span style={{ textTransform: 'none', letterSpacing: 0 }}>fiches et chapitres ouverts</span>
        </div>
        <div className="stat">
          <span>Cœurs</span>
          <strong>{Number(data.totals.likes || 0).toLocaleString('fr-FR')}</strong>
          <span style={{ textTransform: 'none', letterSpacing: 0 }}>réactions laissées</span>
        </div>
        <div className="stat">
          <span>Partages</span>
          <strong>{Number(data.totals.shares || 0).toLocaleString('fr-FR')}</strong>
          <span style={{ textTransform: 'none', letterSpacing: 0 }}>
            dont {data.totals.sharesToday || 0} aujourd’hui
          </span>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 10 }}>Par roman</h2>
        <div className="audience-table">
          <div className="audience-row head">
            <span>Roman</span>
            <span>Vues</span>
            <span>Cœurs</span>
            <span>Partages</span>
            <span>Abonnés</span>
          </div>
          {data.books.map((book) => (
            <div className="audience-row" key={book.id}>
              <span className="audience-title">{book.title}</span>
              <span>{Number(book.views || 0).toLocaleString('fr-FR')}</span>
              <span>{Number(book.likes || 0).toLocaleString('fr-FR')}</span>
              <span>{Number(book.shares || 0).toLocaleString('fr-FR')}</span>
              <span>{Number(book.followers || 0).toLocaleString('fr-FR')}</span>
            </div>
          ))}
          {data.books.length === 0 && <p className="empty">Aucun roman publié.</p>}
        </div>
      </div>

      <div className="split" style={{ marginTop: 20, alignItems: 'start' }}>
        <div className="panel">
          <h2 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Canaux de partage</h2>
          {data.byChannel.length === 0 && <p className="empty">Aucun partage pour l’instant.</p>}
          {data.byChannel.map((row) => (
            <div key={row.channel} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>{CHANNEL_LABELS[row.channel] || row.channel}</span>
                <strong>{row.n}</strong>
              </div>
              <div className="audience-track" style={{ marginTop: 4 }}>
                <div className="audience-fill" style={{ width: `${Math.round((row.n / maxShares) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2 style={{ fontSize: '1.05rem', marginBottom: 12 }}>14 derniers jours</h2>
          {data.daily.length === 0 && <p className="empty">Rien à afficher encore.</p>}
          <div className="bars">
            {data.daily.map((day) => (
              <div className="bar" key={day.day} title={`${day.day} — ${day.n} partage(s)`}>
                <div className="bar-fill" style={{ height: `${Math.max(6, (day.n / maxDay) * 100)}%` }} />
                <span>{day.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
