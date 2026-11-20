import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatXof } from '../api.js';
import ShareSheet from './ShareSheet.jsx';

/**
 * Sortie du jour : le chapitre choisi dans la console s'affiche en haut de
 * l'accueil, avec la couverture du roman et la possibilité de le partager
 * immédiatement.
 */
export default function Spotlight({ spotlight }) {
  const [shareOpen, setShareOpen] = useState(false);
  if (!spotlight) return null;

  const target = spotlight.isFree ? `/lire/${spotlight.bookSlug}/${spotlight.chapter}` : `/roman/${spotlight.bookSlug}`;

  return (
    <>
      <section className="section spotlight-section" aria-label="Sortie du jour">
        <div className="wrap">
          <div className="spotlight">
            <div className="spotlight-cover">
              <img src={spotlight.cover} alt={`Couverture — ${spotlight.bookTitle}`} />
            </div>
            <div className="spotlight-body">
              <span className="spotlight-tag">
                {spotlight.isFree ? 'Nouveau · offert' : 'Nouvelle sortie'} · Chapitre {spotlight.chapter}
              </span>
              <h2>{spotlight.chapterTitle || spotlight.bookTitle}</h2>
              <p className="spotlight-book">
                {spotlight.bookTitle} — {spotlight.author}
              </p>
              <p className="spotlight-line">
                {spotlight.isFree
                  ? 'Ce chapitre est ouvert à tous. Lisez-le maintenant, sans compte et sans payer.'
                  : `Le chapitre s’ouvre pour ${formatXof(spotlight.priceXof)}, par Wave ou Orange Money.`}
              </p>
              <div className="promo-actions">
                <Link to={target} className="btn btn-gold btn-sm">
                  {spotlight.isFree ? 'Lire le chapitre' : 'Voir le roman'}
                </Link>
                <button type="button" className="promo-link" onClick={() => setShareOpen(true)}>
                  Partager →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        bookSlug={spotlight.bookSlug}
        title={spotlight.bookTitle}
      />
    </>
  );
}
