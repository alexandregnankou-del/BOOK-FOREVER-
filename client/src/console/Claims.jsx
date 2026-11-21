import React, { useEffect, useState } from 'react';
import { api, formatDate } from '../api.js';
import { CLAIM_CATEGORIES, STATUS_BADGES } from '../pages/Claims.jsx';

export default function ConsoleClaims() {
  const [claims, setClaims] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [newStatus, setNewStatus] = useState('EN_COURS');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const loadClaims = () => {
    setLoading(true);
    api.admin
      .claims(statusFilter)
      .then((res) => setClaims(res.claims || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadClaims();
  }, [statusFilter]);

  const selectClaim = (claim) => {
    setSelectedClaim(claim);
    setReplyText(claim.adminReply || '');
    setNewStatus(claim.status || 'EN_COURS');
    setNotice('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedClaim) return;
    setBusy(true);
    setNotice('');
    try {
      const res = await api.admin.updateClaim(selectedClaim.id, {
        status: newStatus,
        adminReply: replyText,
      });
      setNotice('Réclamation mise à jour avec succès.');
      setSelectedClaim(res.claim);
      loadClaims();
    } catch (err) {
      setNotice(`Erreur : ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>Aide & Réclamations clients ({claims.length})</h2>
          <p className="muted">Suivi des demandes d’assistance, litiges de paiement et réclamations.</p>
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select"
          >
            <option value="">Tous les statuts</option>
            <option value="OUVERT">OUVERT</option>
            <option value="EN_COURS">EN COURS</option>
            <option value="EN_ATTENTE">EN ATTENTE</option>
            <option value="RESOLU">RESOLU</option>
            <option value="FERME">FERME</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedClaim ? '1fr 1fr' : '1fr', gap: 20, marginTop: 16 }}>
        {/* Liste */}
        <div className="panel">
          {loading ? (
            <p className="empty">Chargement…</p>
          ) : claims.length === 0 ? (
            <p className="empty">Aucune réclamation trouvée.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {claims.map((c) => {
                const badge = STATUS_BADGES[c.status] || STATUS_BADGES.OUVERT;
                const isSelected = selectedClaim?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => selectClaim(c)}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? 'var(--gold, #c9a227)' : 'var(--line)'}`,
                      background: isSelected ? 'rgba(201,162,39,0.06)' : 'rgba(255,255,255,0.01)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{c.claim_number}</strong>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: 12,
                          color: badge.color,
                          backgroundColor: badge.bg,
                          fontWeight: 600,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.84rem', marginTop: 4, color: '#ded7cd' }}>
                      {CLAIM_CATEGORIES.find((cat) => cat.id === c.category)?.label || c.category}
                      {c.order_reference ? ` · Réf : ${c.order_reference}` : ''}
                    </div>
                    <div className="muted" style={{ fontSize: '0.76rem', marginTop: 4 }}>
                      {c.user_email} ({c.user_name || 'Lecteur'}) · {formatDate(c.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Détail & Traitement */}
        {selectedClaim && (
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Dossier {selectedClaim.claim_number}</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedClaim(null)}
              >
                ✕ Fermer
              </button>
            </div>

            <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: '0.88rem' }}>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Lecteur :</strong> {selectedClaim.user_name} ({selectedClaim.user_email})
              </p>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Motif :</strong> {CLAIM_CATEGORIES.find((cat) => cat.id === selectedClaim.category)?.label || selectedClaim.category}
              </p>
              {selectedClaim.order_reference && (
                <p style={{ margin: '0 0 6px' }}>
                  <strong>Réf commande :</strong> {selectedClaim.order_reference}
                </p>
              )}
              {selectedClaim.subject && (
                <p style={{ margin: '0 0 6px' }}>
                  <strong>Objet :</strong> {selectedClaim.subject}
                </p>
              )}
              <hr style={{ borderColor: 'var(--line)', margin: '8px 0' }} />
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#ded7cd' }}>
                {selectedClaim.message}
              </p>
            </div>

            <form onSubmit={handleUpdate} style={{ marginTop: 16 }}>
              <label>
                <span>Statut du dossier</span>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="select"
                >
                  <option value="OUVERT">OUVERT</option>
                  <option value="EN_COURS">EN COURS</option>
                  <option value="EN_ATTENTE">EN ATTENTE</option>
                  <option value="RESOLU">RESOLU</option>
                  <option value="FERME">FERME</option>
                </select>
              </label>

              <label style={{ marginTop: 12 }}>
                <span>Réponse au lecteur</span>
                <textarea
                  rows={5}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Rédigez la réponse ou la solution apportée..."
                  maxLength={5000}
                />
              </label>

              <button type="submit" className="btn btn-gold" disabled={busy} style={{ width: '100%', marginTop: 12 }}>
                {busy ? 'Mise à jour…' : 'Enregistrer la réponse & statut'}
              </button>

              {notice && (
                <p className="ok" style={{ marginTop: 10 }}>
                  {notice}
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
