import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PROMO_VIDEOS } from '../videos.js';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Un clip vertical de 8 secondes, sans son.
 *
 * - Le fichier n'est téléchargé que lorsque la vidéo approche de l'écran
 *   (preload="none" + src posé à l'entrée dans le viewport) : l'accueil ne
 *   consomme pas 5 Mo de forfait à l'ouverture.
 * - Lecture automatique uniquement quand la vidéo occupe la moitié de l'écran,
 *   et jamais si le visiteur a demandé à réduire les animations.
 * - Un appui met en pause ou relance.
 */
export function PromoVideo({ item, autoplay = true }) {
  const videoRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const shown = entry.isIntersecting && entry.intersectionRatio >= 0.35;
          setVisible(shown);
          if (!shown) setPausedByUser(false);
        }
      },
      { threshold: [0, 0.35, 0.7] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const shouldPlay = visible && autoplay && !pausedByUser && !prefersReducedMotion();
    if (!shouldPlay) {
      el.pause();
      return;
    }
    if (!el.getAttribute('src')) el.setAttribute('src', item.src);
    el.muted = true;
    const attempt = el.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => setPlaying(false));
  }, [visible, autoplay, pausedByUser, item.src]);

  const toggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      if (!el.getAttribute('src')) el.setAttribute('src', item.src);
      el.muted = true;
      setPausedByUser(false);
      const attempt = el.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
    } else {
      el.pause();
      setPausedByUser(true);
    }
  };

  return (
    <div className="video-frame">
      <video
        ref={videoRef}
        poster={item.poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={`Vidéo — ${item.title}`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        className={`video-tap ${playing ? 'is-playing' : ''}`}
        onClick={toggle}
        aria-label={playing ? `Mettre en pause — ${item.title}` : `Lire la vidéo — ${item.title}`}
      >
        <span aria-hidden="true">{playing ? '❙❙' : '▶'}</span>
      </button>
    </div>
  );
}

/**
 * Bandeau vidéo de l'accueil : les clips défilent horizontalement, comme une
 * rangée de publicités, et renvoient vers le roman ou la chaîne WhatsApp.
 */
export default function VideoRail({ channelUrl = '', items = PROMO_VIDEOS }) {
  if (!items.length) return null;

  return (
    <section className="section video-section" aria-label="Les romans en vidéo">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">En vidéo</span>
            <h2>Les romans en huit secondes</h2>
            <p>Un aperçu par roman. Appuyez sur une vidéo pour la mettre en pause.</p>
          </div>
          <Link to="/videos" className="btn btn-ghost btn-sm">
            Toutes les vidéos
          </Link>
        </div>

        <div className="video-rail">
          {items.map((item) => (
            <article className="video-card" key={item.id}>
              <PromoVideo item={item} />
              <div className="video-meta">
                <h3>{item.title}</h3>
                <p>{item.line}</p>
                {item.channel ? (
                  channelUrl ? (
                    <a className="video-link" href={channelUrl} target="_blank" rel="noreferrer">
                      {item.cta} →
                    </a>
                  ) : null
                ) : (
                  <Link className="video-link" to={item.to}>
                    {item.cta} →
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
