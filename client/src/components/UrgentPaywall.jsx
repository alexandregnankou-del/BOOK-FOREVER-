import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatXof } from '../api.js';

export default function UrgentPaywall({
  book,
  chapter,
  onBuyChapter,
  onBuyFull,
  busy,
  user,
  credits = 0,
  onUnlockCredit,
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    try {
      const saved = sessionStorage.getItem('bf_timer_end');
      if (saved) {
        const remain = Math.max(0, Math.floor((Number(saved) - Date.now()) / 1000));
        return remain > 0 ? remain : 900;
      }
      const end = Date.now() + 15 * 60 * 1000;
      sessionStorage.setItem('bf_timer_end', String(end));
      return 900;
    } catch {
      return 900;
    }
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div
      className="urgent-paywall-box"
      style={{
        background: 'linear-gradient(145deg, #1f1a15, #14110e)',
        border: '1px solid rgba(201, 162, 39, 0.45)',
        borderRadius: 14,
        padding: '24px 20px',
        margin: '24px 0',
        textAlign: 'center',
        color: '#f5eee6',
        boxShadow: '0 12px 35px rgba(0,0,0,0.7)',
      }}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#c9a227', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>
        <span>🔒 Fin des chapitres offerts</span>
      </div>

      <h2 style={{ fontSize: '1.45rem', margin: '0 0 8px', color: '#fff' }}>
        Ne laissez pas l’intrigue en suspens…
      </h2>

      <p style={{ fontSize: '0.92rem', color: '#c4b5a5', maxWidth: 480, margin: '0 auto 16px', lineHeight: 1.5 }}>
        L’histoire de <strong>« {book?.title} »</strong> prend un tournant décisif au chapitre {chapter?.number || 3}. Débloquez la suite immédiatement en 1 clic.
      </p>

      {/* Compte à rebours dynamique */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(201, 162, 39, 0.12)',
          border: '1px solid rgba(201, 162, 39, 0.3)',
          padding: '6px 14px',
          borderRadius: 20,
          fontSize: '0.85rem',
          color: '#e5be49',
          marginBottom: 20,
        }}
      >
        <span>⚡ Offre lecture immédiate expire dans :</span>
        <strong style={{ fontFamily: 'monospace', fontSize: '1.05rem', color: '#ffb800' }}>
          {mm}:{ss}
        </strong>
      </div>

      <div style={{ display: 'grid', gap: 12, maxWidth: 400, margin: '0 auto' }}>
        {/* Option A : Chapitre unitaire */}
        <button
          type="button"
          onClick={onBuyChapter}
          disabled={busy}
          className="btn btn-gold btn-block"
          style={{
            padding: '14px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Préparation…' : `👉 1. Débloquer le Chapitre ${chapter?.number || 3} (${formatXof(chapter?.priceXof || 300)})`}
        </button>

        {/* Option B : Roman Intégral */}
        <button
          type="button"
          onClick={onBuyFull}
          disabled={busy}
          className="btn btn-block"
          style={{
            background: 'linear-gradient(135deg, #c9a227, #9b7a1c)',
            color: '#14110e',
            border: 'none',
            borderRadius: 8,
            padding: '13px',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          ⚡ 2. Débloquer TOUT le roman — 1 500 FCFA (-66%)
        </button>

        {credits > 0 && (
          <button
            type="button"
            onClick={onUnlockCredit}
            disabled={busy}
            className="btn btn-ghost btn-block"
            style={{ fontSize: '0.9rem' }}
          >
            Utiliser 1 crédit de lecture ({credits} disponible{credits > 1 ? 's' : ''})
          </button>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: '0.8rem', color: '#9e8f80' }}>
        <span>Paiement direct Wave & Orange Money · Déblocage en 1 seconde</span>
      </div>
    </div>
  );
}
