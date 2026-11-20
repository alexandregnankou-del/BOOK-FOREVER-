import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatXof } from '../api.js';

/**
 * Bandeau « À la une » de l'accueil : les romans défilent doucement, avec une
 * dernière carte pour la chaîne WhatsApp. Purement publicitaire — chaque carte
 * mène à la fiche ou au premier chapitre offert.
 */
export default function PromoRail({ books = [], channelUrl = '' }) {
  const railRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const total = books.length + (channelUrl ? 1 : 0);

  const goTo = (next) => {
    const rail = railRef.current;
    if (!rail || total === 0) return;
    const bounded = ((next % total) + total) % total;
    const card = rail.children[bounded];
    if (card) rail.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
    setIndex(bounded);
  };

  /* Défilement automatique, coupé dès que le lecteur touche au bandeau. */
  useEffect(() => {
    if (paused || total < 2) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => {
      const rail = railRef.current;
      if (!rail) return;
      const card = rail.children[(index + 1) % total];
      if (card) rail.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
      setIndex((index + 1) % total);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [index, paused, total]);

  /* L'index suit le doigt quand on fait glisser le bandeau. */
  const onScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    let nearest = 0;
    let distance = Infinity;
    for (let i = 0; i < rail.children.length; i += 1) {
      const gap = Math.abs(rail.children[i].offsetLeft - rail.scrollLeft);
      if (gap < distance) {
        distance = gap;
        nearest = i;
      }
    }
    setIndex(nearest);
  };

  if (total === 0) return null;

  return (
    <section className="section promo-section" aria-label="À la une">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">À la une</span>
            <h2>Des histoires à commencer ce soir</h2>
          </div>
          {total > 1 && (
            <div className="promo-nav">
              <button type="button" onClick={() => goTo(index - 1)} aria-label="Carte précédente">
                ←
              </button>
              <button type="button" onClick={() => goTo(index + 1)} aria-label="Carte suivante">
                →
              </button>
            </div>
          )}
        </div>

        <div
          className="promo-rail"
          ref={railRef}
          onScroll={onScroll}
          onPointerDown={() => setPaused(true)}
          onFocus={() => setPaused(true)}
        >
          {books.map((book) => (
            <article className="promo-card" key={book.id || book.slug}>
              <div className="promo-cover">
                <img src={book.cover} alt={`Couverture — ${book.title}`} loading="lazy" />
              </div>
              <div className="promo-body">
                <span className="eyebrow">{book.category?.name || 'Roman'}</span>
                <h3>{book.title}</h3>
                <p className="promo-author">{book.author}</p>
                {book.tagline && <p className="promo-line">{book.tagline}</p>}
                <div className="book-facts" style={{ marginBottom: 12 }}>
                  <span className="pill free">{book.chaptersFree} chapitres offerts</span>
                  <span className="pill">{formatXof(book.priceXof)} la suite</span>
                </div>
                <div className="promo-actions">
                  <Link to={`/lire/${book.slug}/1`} className="btn btn-gold btn-sm">
                    Commencer
                  </Link>
                  <Link to={`/roman/${book.slug}`} className="promo-link">
                    Voir le roman →
                  </Link>
                </div>
              </div>
            </article>
          ))}

          {channelUrl && (
            <article className="promo-card promo-channel">
              <div className="promo-body">
                <span className="eyebrow">Chaîne WhatsApp</span>
                <h3>Les nouveautés avant tout le monde</h3>
                <p className="promo-line">
                  Les nouveautés arrivent d’abord là : nouveaux chapitres, sorties et offres.
                </p>
                <ul className="promo-list">
                  <li>Un chapitre publié = une annonce</li>
                  <li>Aucun message privé, aucun spam</li>
                  <li>Vous quittez la chaîne quand vous voulez</li>
                </ul>
                <div className="promo-actions">
                  <a className="btn btn-gold btn-sm" href={channelUrl} target="_blank" rel="noreferrer">
                    Rejoindre la chaîne
                  </a>
                  <Link to="/bibliotheque" className="promo-link">
                    Voir les romans →
                  </Link>
                </div>
              </div>
            </article>
          )}
        </div>

        {total > 1 && (
          <div className="promo-dots">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                type="button"
                className={i === index ? 'on' : ''}
                onClick={() => goTo(i)}
                aria-label={`Aller à la carte ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
