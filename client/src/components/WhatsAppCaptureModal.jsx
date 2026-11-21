import React, { useState } from 'react';
import { api } from '../api.js';

export function validateIvorianPhone(raw) {
  if (!raw) return { valid: false, error: 'Veuillez saisir votre numéro WhatsApp.' };
  const digits = String(raw).replace(/[^0-9]/g, '');
  
  // Format international 225XXXXXXXXXX
  if (digits.length === 12 && digits.startsWith('225')) {
    const local = digits.slice(3);
    if (/^(01|05|07)\d{8}$/.test(local)) {
      return { valid: true, clean: local };
    }
  }
  
  // Format local 10 chiffres (07, 05, 01)
  if (digits.length === 10) {
    if (/^(01|05|07)\d{8}$/.test(digits)) {
      return { valid: true, clean: digits };
    }
    return { valid: false, error: 'Le numéro doit commencer par 01, 05 ou 07.' };
  }
  
  if (digits.length < 10) {
    return { valid: false, error: 'Numéro incomplet (10 chiffres requis).' };
  }
  
  return { valid: false, error: 'Format invalide. Exemple : 07 06 48 69 04' };
}

export default function WhatsAppCaptureModal({ bookSlug, onUnlocked }) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const check = validateIvorianPhone(phone);
    if (!check.valid) {
      setError(check.error);
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api.captureLead({ phone: check.clean, bookSlug });
      try {
        localStorage.setItem('bf_whatsapp', check.clean);
      } catch {}
      onUnlocked?.(check.clean);
    } catch (err) {
      // En cas d'erreur réseau, on enregistre quand même en local pour ne pas bloquer le lecteur
      try {
        localStorage.setItem('bf_whatsapp', check.clean);
      } catch {}
      onUnlocked?.(check.clean);
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('bf_whatsapp_skip', '1');
    } catch {}
    onUnlocked?.(null);
  };

  return (
    <div className="receipt-overlay" style={{ zIndex: 1200 }}>
      <div
        className="receipt-dialog"
        style={{
          maxWidth: 460,
          background: 'linear-gradient(145deg, #1d1915, #14110e)',
          color: '#f5eee6',
          border: '1px solid rgba(201, 162, 39, 0.4)',
          borderRadius: 16,
          padding: '28px 24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📖</div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--gold, #c9a227)', margin: '0 0 6px' }}>
            Accès Gratuit aux 2 Premiers Chapitres
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#c4b5a5', margin: 0, lineHeight: 1.45 }}>
            Rejoignez plus de 1 000 lecteurs passionnés de littérature ivoirienne.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, textAlign: 'left' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f5eee6' }}>
              Votre numéro WhatsApp (10 chiffres) *
            </span>
            <input
              type="tel"
              placeholder="Ex: 07 06 48 69 04 ou 05 / 01"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error) setError('');
              }}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '1rem',
                borderRadius: 8,
                border: error ? '1px solid #ff6b6b' : '1px solid rgba(201, 162, 39, 0.3)',
                background: '#0d0b09',
                color: '#fff',
                outline: 'none',
              }}
              autoFocus
            />
          </label>

          {error && (
            <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: 0, textAlign: 'left' }}>
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn btn-gold btn-block"
            style={{
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Déblocage en cours...' : '⚡ Je reçois mon accès gratuit'}
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            padding: '12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.82rem',
            color: '#9e8f80',
            lineHeight: 1.5,
            textAlign: 'left',
          }}
        >
          <div>✅ <strong>Aucun spam.</strong> Tu peux te désinscrire à tout moment.</div>
          <div>✅ <strong>2 chapitres offerts immédiatement</strong> sur ce roman.</div>
          <div>🎁 Reçois le lien et tes bonus de lecture directement.</div>
        </div>

        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              color: '#7a6f64',
              fontSize: '0.78rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Passer et lire sans laisser de contact
          </button>
        </div>
      </div>
    </div>
  );
}
