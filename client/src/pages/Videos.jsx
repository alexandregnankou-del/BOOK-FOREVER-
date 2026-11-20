import { Link } from 'react-router-dom';
import { useSite } from '../site.jsx';
import { PROMO_VIDEOS } from '../videos.js';
import { PromoVideo } from '../components/VideoRail.jsx';

/**
 * Page « Vidéos » : les cinq clips promotionnels, lisibles en grand, partageables
 * par simple copie du lien. Les mêmes fichiers sont embarqués dans l'application
 * Android, donc la page fonctionne aussi hors connexion.
 */
export default function Videos() {
  const site = useSite();

  return (
    <div className="page">
      <div className="wrap">
        <div className="videos-hero">
          <span className="eyebrow">Vidéos</span>
          <h1>Les romans, en images</h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            Huit secondes par roman. Les vidéos sont verticales, prêtes à être partagées sur WhatsApp,
            TikTok ou Facebook — et elles se lisent aussi dans l’application, sans connexion.
          </p>
        </div>

        <div className="videos-grid">
          {PROMO_VIDEOS.map((item) => (
            <figure className="video-tile" key={item.id}>
              <PromoVideo item={item} />
              <figcaption>
                <span className="video-tile-tag">{item.author}</span>
                <h2>{item.title}</h2>
                <p>{item.line}</p>
                {item.channel ? (
                  site.channelUrl ? (
                    <a className="btn btn-gold btn-sm" href={site.channelUrl} target="_blank" rel="noreferrer">
                      {item.cta}
                    </a>
                  ) : (
                    <Link className="btn btn-ghost btn-sm" to="/bibliotheque">
                      Voir les romans
                    </Link>
                  )
                ) : (
                  <Link className="btn btn-gold btn-sm" to={item.to}>
                    {item.cta}
                  </Link>
                )}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="videos-footer">
          <p className="hint">
            Chaque clip présente la couverture réelle du roman. Les deux premiers chapitres restent
            offerts, sans compte ni paiement.
          </p>
          <div className="videos-footer-actions">
            <Link className="btn" to="/bibliotheque">
              Voir tous les romans
            </Link>
            {site.channelUrl && (
              <a className="btn btn-ghost" href={site.channelUrl} target="_blank" rel="noreferrer">
                Chaîne WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
