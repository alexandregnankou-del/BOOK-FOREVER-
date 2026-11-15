import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../site.jsx';

export default function Install() {
  const site = useSite();
  const [prompt, setPrompt] = useState(null);
  const [shared, setShared] = useState('');

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  const share = async () => {
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: site.siteName, text: 'Les romans d’Alexandre Anderson G', url });
      } catch {
        /* partage annulé */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared('Lien copié.');
    } catch {
      setShared(url);
    }
  };

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <span className="eyebrow">Application</span>
          <h1>Installer {site.siteName} sur votre téléphone</h1>
          <p className="muted">
            Une icône sur l’écran d’accueil, ouverture en plein écran, et lecture possible même avec une connexion
            faible. Il s’agit d’une application web installable — elle ne passe pas par l’App Store ni Google Play,
            donc rien à télécharger ni à mettre à jour manuellement.
          </p>
        </div>

        <div className="split" style={{ alignItems: 'start' }}>
          <div className="install-card">
            <h3>iPhone / iPad</h3>
            <ol>
              <li>Ouvrez ce site dans <strong>Safari</strong>.</li>
              <li>Touchez le bouton <strong>Partager</strong> (carré avec une flèche).</li>
              <li>Choisissez <strong>Sur l’écran d’accueil</strong>.</li>
              <li>Validez avec <strong>Ajouter</strong>.</li>
            </ol>
          </div>
          <div className="install-card">
            <h3>Android</h3>
            <ol>
              <li>Ouvrez ce site dans <strong>Chrome</strong>.</li>
              <li>Touchez le menu <strong>⋮</strong> en haut à droite.</li>
              <li>Choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</li>
              <li>Confirmez.</li>
            </ol>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 26, flexWrap: 'wrap' }}>
          <img className="qr" src="/icons/qr-site.png" alt="QR code vers la bibliothèque" />
          <div>
            <p style={{ marginBottom: 12 }}>
              <strong>Ouvrir sur un autre téléphone</strong>
              <br />
              <span className="muted" style={{ fontSize: '0.86rem' }}>
                Scannez ce QR code, ou partagez le lien.
              </span>
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {prompt && (
                <button type="button" className="btn btn-gold" onClick={install}>
                  Installer maintenant
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={share}>
                Partager le lien
              </button>
              <Link to="/bibliotheque" className="btn btn-ghost">
                Voir la bibliothèque
              </Link>
            </div>
            {shared && <p className="muted" style={{ fontSize: '0.8rem', marginTop: 10 }}>{shared}</p>}
          </div>
        </div>

        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 26 }}>
          Astuce : si la page ne s’ouvre pas depuis Facebook ou WhatsApp, touchez « ⋯ » puis « Ouvrir dans le
          navigateur ».
        </p>
      </div>
    </div>
  );
}
