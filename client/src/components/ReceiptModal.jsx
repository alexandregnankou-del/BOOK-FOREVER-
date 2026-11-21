import React from 'react';
import { formatDate, formatXof, METHOD_LABELS } from '../api.js';
import { useSite } from '../site.jsx';

export default function ReceiptModal({ receipt, onClose }) {
  const site = useSite();
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const statusLabel =
    receipt.status === 'confirmed'
      ? 'Paiement confirmé · Accès actif'
      : receipt.status === 'expired'
      ? 'Accès 30 jours expiré'
      : 'Remboursé';

  const statusColor =
    receipt.status === 'confirmed'
      ? '#10b981'
      : receipt.status === 'expired'
      ? '#f59e0b'
      : '#6b7280';

  return (
    <div className="receipt-overlay" onClick={onClose}>
      <div className="receipt-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-dialog-actions no-print">
          <button type="button" className="btn btn-gold btn-sm" onClick={handlePrint}>
            🖨️ Imprimer / Télécharger en PDF
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕ Fermer
          </button>
        </div>

        <div className="receipt-document">
          {/* En-tête Vendeur */}
          <div className="receipt-header">
            <div>
              <h2 style={{ fontFamily: 'var(--serif)', margin: '0 0 4px', fontSize: '1.6rem', color: '#14110e' }}>
                {site.siteName || 'BOOK FOREVER'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#666' }}>
                {site.publisher || 'ADISEN — section Littérature'}<br />
                {site.address || 'Abidjan, Côte d’Ivoire'}<br />
                {site.contactEmail} · {site.contactPhone}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="receipt-badge" style={{ backgroundColor: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}60` }}>
                {statusLabel}
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '0.82rem', fontWeight: 600, color: '#14110e' }}>
                Reçu N° {receipt.receiptNumber}
              </p>
            </div>
          </div>

          <hr style={{ borderColor: '#e2d8c8', margin: '16px 0' }} />

          {/* Informations Transaction */}
          <table className="receipt-table">
            <tbody>
              <tr>
                <th>Référence Commande</th>
                <td><strong>{receipt.reference}</strong></td>
                <th>Moyen de paiement</th>
                <td>{METHOD_LABELS[receipt.paymentMethod] || receipt.paymentMethod}</td>
              </tr>
              <tr>
                <th>Date de paiement</th>
                <td>{formatDate(receipt.confirmedAt || receipt.createdAt)}</td>
                <th>Devise</th>
                <td>Franc CFA ({receipt.currency || 'XOF'})</td>
              </tr>
              <tr>
                <th>Début du droit d'accès</th>
                <td>{formatDate(receipt.accessStartsAt || receipt.confirmedAt)}</td>
                <th>Expiration du droit (30j)</th>
                <td>
                  <strong>{formatDate(receipt.expiresAt)}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Détail de l'achat */}
          <div className="receipt-item-box">
            <div className="receipt-item-row header">
              <span>Désignation de l'ouvrage</span>
              <span style={{ textAlign: 'center' }}>Type d'accès</span>
              <span style={{ textAlign: 'right' }}>Montant</span>
            </div>
            <div className="receipt-item-row body">
              <div>
                <strong>{receipt.bookTitle}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#666' }}>
                  Chapitre {receipt.chapterNumber} — {receipt.chapterTitle}
                </p>
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                Accès numérique 30 jours
              </div>
              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem' }}>
                {formatXof(receipt.amountXof)}
              </div>
            </div>
            <div className="receipt-item-row total">
              <span>Total net acquitté</span>
              <span></span>
              <span style={{ textAlign: 'right', color: '#9b7a1c', fontSize: '1.2rem', fontWeight: 700 }}>
                {formatXof(receipt.amountXof)}
              </span>
            </div>
          </div>

          {/* Mentions Légales & Intégrité */}
          <div className="receipt-footer">
            <p>
              <strong>Preuve d'achat électronique certifiée</strong> émise par {site.publisher || 'ADISEN'} conformément
              aux dispositions de la Loi ivoirienne n° 2013-546 du 30 juillet 2013 relative aux transactions électroniques.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#888' }}>
              Ce document atteste du droit de consultation numérique accordé sur le compte de l'acquéreur.
              Les réclamations éventuelles s'effectuent via le service client sur {site.siteName}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
