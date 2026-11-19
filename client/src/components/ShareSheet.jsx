import { useEffect, useState } from 'react';
import { api } from '../api.js';

/**
 * Feuille de partage : le lecteur diffuse un lien vers un roman ou vers le site.
 * Chaque envoi est compté côté serveur (canal + code de parrainage), pour que la
 * console puisse montrer ce que la diffusion rapporte vraiment.
 */
export default function ShareSheet({ open, onClose, bookSlug = '', title = '', compact = false }) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [total, setTotal] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    api
      .myShares()
      .then((data) => alive && setCode(data.code || ''))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const path = bookSlug ? `/roman/${bookSlug}` : '/';
  const link = `${origin}${path}${code ? `?ref=${code}` : ''}`;
  const message = bookSlug
    ? `Je lis « ${title} » sur BOOK FOREVER. Deux chapitres offerts, la suite pour 300 FCFA.`
    : 'BOOK FOREVER — des romans à lire chapitre par chapitre. Deux chapitres offerts par roman.';

  const track = (channel) => {
    api
      .share({ bookSlug, channel })
      .then((res) => setTotal(res.shares))
      .catch(() => {});
  };

  const openTarget = (channel) => {
    const urls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(link)}`,
    };
    track(channel);
    window.open(urls[channel], '_blank', 'noopener,noreferrer');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setNote('Lien copié — collez-le où vous voulez.');
    } catch {
      setNote('Copie impossible : sélectionnez le lien ci-dessous.');
    }
    track('copie');
    window.setTimeout(() => setCopied(false), 2200);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: title || 'BOOK FOREVER', text: message, url: link });
      track('native');
    } catch {
      /* partage annulé par le lecteur */
    }
  };

  const options = [
    ['whatsapp', 'WhatsApp', '#25D366', 'Envoyer à un contact ou à un groupe'],
    ['telegram', 'Telegram', '#2AABEE', 'Canaux et discussions'],
    ['facebook', 'Facebook', '#1877F2', 'Mur ou groupe de lecture'],
    ['x', 'X / Twitter', '#111111', 'Publier sur le fil'],
  ];

  return (
    <div className="share-backdrop" onClick={onClose} role="presentation">
      <div
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Partager"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="share-grab" aria-hidden="true" />
        <div className="share-head">
          <div>
            <span className="eyebrow">Faire connaître</span>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem' }}>
              {bookSlug ? title || 'Partager ce roman' : 'Partager BOOK FOREVER'}
            </h2>
          </div>
          <button type="button" className="share-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <p className="hint" style={{ margin: '6px 0 14px' }}>
          {code
            ? 'Votre code de parrainage est ajouté au lien : chaque ami qui s’inscrit vous rapproche d’un chapitre offert.'
            : 'Le lien s’ouvre sur la fiche du roman. Créez un compte pour obtenir votre code de parrainage.'}
        </p>

        <div className="share-grid">
          {options.map(([id, label, color, sub]) => (
            <button key={id} type="button" className="share-option" onClick={() => openTarget(id)}>
              <span className="share-dot" style={{ background: color }} aria-hidden="true" />
              <span className="share-label">{label}</span>
              <span className="share-sub">{sub}</span>
            </button>
          ))}
          <button type="button" className="share-option" onClick={copy}>
            <span className="share-dot" style={{ background: '#b98b2e' }} aria-hidden="true" />
            <span className="share-label">{copied ? 'Lien copié' : 'Copier le lien'}</span>
            <span className="share-sub">À coller dans une story, une bio…</span>
          </button>
          {!compact && typeof navigator !== 'undefined' && navigator.share && (
            <button type="button" className="share-option" onClick={nativeShare}>
              <span className="share-dot" style={{ background: '#6b5cff' }} aria-hidden="true" />
              <span className="share-label">Autres applications</span>
              <span className="share-sub">Le menu de votre téléphone</span>
            </button>
          )}
        </div>

        <div className="share-link">
          <code>{link}</code>
        </div>
        {note && (
          <p className="hint" style={{ margin: '8px 0 0' }}>
            {note}
          </p>
        )}
        {total != null && (
          <p className="hint" style={{ margin: '8px 0 0' }}>
            {total} partage{total > 1 ? 's' : ''} enregistré{total > 1 ? 's' : ''} au total
            {bookSlug ? ' pour ce roman' : ' sur le site'}.
          </p>
        )}
      </div>
    </div>
  );
}
