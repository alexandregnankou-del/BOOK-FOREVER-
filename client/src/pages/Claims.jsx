import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatDate } from '../api.js';
import { useSession } from '../session.jsx';
import { useSite } from '../site.jsx';

export const CLAIM_CATEGORIES = [
  { id: 'paiement_bloque', label: 'Paiement effectué mais chapitre verrouillé' },
  { id: 'non_confirme', label: 'Paiement débité mais non confirmé' },
  { id: 'double_paiement', label: 'Double paiement' },
  { id: 'inaccessible', label: 'Chapitre inaccessible' },
  { id: 'expiration_incorrecte', label: 'Date d’expiration incorrecte' },
  { id: 'connexion', label: 'Problème de connexion' },
  { id: 'remboursement', label: 'Demande de remboursement' },
  { id: 'autre', label: 'Autre problème' },
];

export const STATUS_BADGES = {
  OUVERT: { label: 'Ouvert', color: '#c9a227', bg: 'rgba(201,162,39,0.15)' },
  EN_COURS: { label: 'En cours de traitement', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  EN_ATTENTE: { label: 'En attente de précision', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  RESOLU: { label: 'Résolu', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  FERME: { label: 'Fermé', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
};

export default function Claims() {
  const { user, ready } = useSession();
  const site = useSite();
  const navigate = useNavigate();

  const [claimsList, setClaimsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    category: 'paiement_bloque',
    orderReference: '',
    subject: '',
    message: '',
  });
  const [notice, setNotice] = useState({ type: '', text: '' });

  const loadClaims = () => {
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .claims()
      .then((res) => setClaimsList(res.claims || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (ready && !user) {
      navigate('/connexion?next=/reclamations');
      return;
    }
    loadClaims();
  }, [ready, user]);

  const submitClaim = async (e) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setBusy(true);
    setNotice({ type: '', text: '' });
    try {
      const res = await api.createClaim(form);
      setNotice({ type: 'ok', text: res.message });
      setForm({ category: 'paiement_bloque', orderReference: '', subject: '', message: '' });
      loadClaims();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className="page">
        <div className="wrap">
          <p className="empty">Chargement de vos réclamations…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <span className="eyebrow">Service Client & Suivi</span>
          <h1>Aide & Réclamations</h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            Un souci avec une commande, un paiement ou l’accès à un chapitre ? Ouvrez un dossier d’assistance.
            Chaque demande reçoit un numéro de dossier unique et est traitée sous 24h par notre équipe.
          </p>
        </div>

        <div className="about-grid" style={{ marginTop: 24 }}>
          {/* Formulaire de création */}
          <div className="panel">
            <h2>Ouvrir une réclamation</h2>
            <form className="form" onSubmit={submitClaim}>
              <label>
                <span>Motif de la réclamation *</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="select"
                  required
                >
                  {CLAIM_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Référence de commande concernée (si applicable)</span>
                <input
                  type="text"
                  placeholder="Ex : BF-2026-A1B2C3"
                  value={form.orderReference}
                  onChange={(e) => setForm({ ...form, orderReference: e.target.value })}
                  maxLength={60}
                />
              </label>

              <label>
                <span>Objet synthétique</span>
                <input
                  type="text"
                  placeholder="Ex : Déblocage chapitre 3 Amour Perdu"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  maxLength={120}
                />
              </label>

              <label>
                <span>Description détaillée du problème *</span>
                <textarea
                  rows={6}
                  placeholder="Expliquez clairement votre situation (heure du paiement, numéro utilisé, message affiché)..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                  minLength={10}
                  maxLength={5000}
                />
              </label>

              <button type="submit" className="btn btn-gold" disabled={busy} style={{ width: '100%', marginTop: 8 }}>
                {busy ? 'Enregistrement…' : 'Envoyer ma réclamation'}
              </button>

              {notice.text && (
                <p className={notice.type === 'ok' ? 'ok' : 'error'} style={{ marginTop: 14 }}>
                  {notice.text}
                </p>
              )}
            </form>
          </div>

          {/* Contact direct rapide */}
          <div className="panel">
            <h2>Assistance directe</h2>
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              Pour un traitement immédiat en journée, vous pouvez également nous joindre directement :
            </p>
            <ul className="auteurs-list" style={{ marginTop: 14 }}>
              <li>
                <strong>WhatsApp Service Client :</strong>{' '}
                <a
                  href={`https://wa.me/${String(site.contactPhone || '').replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--gold, #c9a227)', fontWeight: 600 }}
                >
                  {site.contactPhone}
                </a>
              </li>
              <li>
                <strong>E-mail :</strong> <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
              </li>
              <li>
                <strong>Horaires d'assistance :</strong> {site.supportHours || 'Lundi – samedi, 8h – 20h'}
              </li>
            </ul>

            <div style={{ marginTop: 24, padding: 16, background: 'rgba(201,162,39,0.06)', borderRadius: 8, border: '1px solid rgba(201,162,39,0.2)' }}>
              <strong style={{ display: 'block', color: 'var(--gold, #c9a227)', marginBottom: 6 }}>
                Garantie de prise en charge
              </strong>
              <span style={{ fontSize: '0.85rem', color: '#ded7cd', lineHeight: 1.5 }}>
                En cas de double débit ou de déblocage manqué avéré, le droit de lecture est rétabli sous 30 minutes ou la transaction remboursée sans frais.
              </span>
            </div>
          </div>
        </div>

        {/* Historique des dossiers */}
        <div className="panel" style={{ marginTop: 24 }}>
          <h2>Mes dossiers d'assistance ({claimsList.length})</h2>
          {claimsList.length === 0 ? (
            <p className="empty">Aucune réclamation enregistrée sur votre compte.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
              {claimsList.map((c) => {
                const badge = STATUS_BADGES[c.status] || STATUS_BADGES.OUVERT;
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: 16,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <strong style={{ fontSize: '1.05rem', color: '#fff' }}>Dossier {c.claimNumber}</strong>
                        <span className="muted" style={{ marginLeft: 12, fontSize: '0.82rem' }}>
                          Ouvert le {formatDate(c.createdAt)}
                        </span>
                      </div>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: badge.color,
                          backgroundColor: badge.bg,
                          border: `1px solid ${badge.color}40`,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <p style={{ margin: '10px 0 6px', fontWeight: 600, color: '#ded7cd' }}>
                      {CLAIM_CATEGORIES.find((cat) => cat.id === c.category)?.label || c.category}
                      {c.orderReference ? ` · Commande : ${c.orderReference}` : ''}
                    </p>

                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#9a9082', whiteSpace: 'pre-wrap' }}>{c.message}</p>

                    {c.adminReply && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: 12,
                          background: 'rgba(201,162,39,0.08)',
                          borderLeft: '3px solid var(--gold, #c9a227)',
                          borderRadius: '0 6px 6px 0',
                        }}
                      >
                        <strong style={{ fontSize: '0.82rem', color: 'var(--gold, #c9a227)', display: 'block', marginBottom: 4 }}>
                          Réponse du Support BOOK FOREVER :
                        </strong>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#ded7cd', whiteSpace: 'pre-wrap' }}>{c.adminReply}</p>
                        {c.resolvedAt && (
                          <span className="muted" style={{ display: 'block', fontSize: '0.75rem', marginTop: 4 }}>
                            Traité le {formatDate(c.resolvedAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
