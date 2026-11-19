import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatXof } from '../api.js';
import EmojiBar from '../components/EmojiBar.jsx';
import ShareSheet from '../components/ShareSheet.jsx';
import { useSession } from '../session.jsx';

export default function BookPage() {
  const { slug } = useParams();
  const { user } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setFavorite(false);
      return;
    }
    api
      .favorites()
      .then(({ slugs }) => setFavorite((slugs || []).includes(slug)))
      .catch(() => setFavorite(false));
  }, [slug, user]);

  const toggleFavorite = async () => {
    if (!user) {
      window.location.assign(`/connexion?next=${encodeURIComponent(`/roman/${slug}`)}`);
      return;
    }
    setFavBusy(true);
    try {
      if (favorite) {
        await api.removeFavorite(slug);
        setFavorite(false);
      } else {
        await api.addFavorite(slug);
        setFavorite(true);
      }
    } catch {
      /* on laisse l'état inchangé, l'utilisateur peut réessayer */
    } finally {
      setFavBusy(false);
    }
  };

  useEffect(() => {
    setData(null);
    setError('');
    api
      .book(slug)
      .then((payload) => {
        setData(payload);
        api.viewBook(slug).catch(() => {});
      })
      .catch((err) => setError(err.message));
  }, [slug]);

  if (error) {
    return (
      <div className="page">
        <div className="wrap">
          <p className="empty">{error}</p>
          <p className="center">
            <Link to="/bibliotheque" className="btn btn-ghost">
              Retour à la bibliothèque
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (!data) return <p className="empty">Chargement…</p>;

  const { book, chapters } = data;
  const first = chapters[0];

  return (
    <div className="wrap">
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        bookSlug={book.slug}
        title={book.title}
      />
      <div className="book-hero">
        <div className="cover">
          <img src={book.cover} alt={`Couverture — ${book.title}`} />
        </div>
        <div>
          <span className="eyebrow">{book.category?.name}</span>
          <h1>{book.title}</h1>
          <div className="author muted" style={{ fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {book.author}
          </div>
          {book.tagline && <p className="tagline">{book.tagline}</p>}
          <div className="book-facts">
            <span className="pill free">{book.chaptersFree} chapitres offerts</span>
            <span className="pill">{formatXof(book.priceXof)} le chapitre</span>
            <span className="pill dark">{book.chaptersPublished} chapitres publiés</span>
          </div>
          <button
            type="button"
            className={`fav-toggle ${favorite ? 'on' : ''}`}
            onClick={toggleFavorite}
            disabled={favBusy}
            aria-pressed={favorite}
          >
            <span aria-hidden="true">{favorite ? '♥' : '♡'}</span>
            {favorite ? 'Dans mes favoris' : 'Ajouter aux favoris'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setShareOpen(true)}>
            <span aria-hidden="true">↗</span> Partager
          </button>
          <section className="book-info">
            <header className="book-info-head">
              <span className="eyebrow">Informations &amp; résumé</span>
            </header>
            <div className="book-info-grid">
              <div>
                <h2 className="book-info-title">Le roman</h2>
                <p className="synopsis">{book.synopsis}</p>
              </div>
              <dl className="book-info-list">
                <div>
                  <dt>Auteur</dt>
                  <dd>{book.author}</dd>
                </div>
                <div>
                  <dt>Genre</dt>
                  <dd>{book.category?.name || 'Roman'}</dd>
                </div>
                <div>
                  <dt>Chapitres</dt>
                  <dd>{book.chaptersTotal}</dd>
                </div>
                <div>
                  <dt>Offerts</dt>
                  <dd>{book.freeChapters} premiers</dd>
                </div>
                <div>
                  <dt>Prix</dt>
                  <dd>{formatXof(book.priceXof)} le chapitre</dd>
                </div>
              </dl>
            </div>
            <EmojiBar slug={book.slug} audience={data.audience} />
          </section>
          {first && (
            <div style={{ marginTop: 24 }}>
              <Link to={`/lire/${book.slug}/${first.number}`} className="btn btn-gold">
                Lire le premier chapitre
              </Link>
            </div>
          )}
        </div>
      </div>

      <section style={{ paddingBottom: 70 }}>
        <div className="section-head">
          <div>
            <h2 style={{ fontSize: '1.6rem' }}>Sommaire</h2>
            <p className="muted">
              {chapters.filter((c) => c.isFree).length} chapitres gratuits ·{' '}
              {chapters.filter((c) => !c.unlocked).length} à débloquer
            </p>
          </div>
        </div>
        <div className="chapter-list">
          {chapters.map((chapter) => (
            <Link
              key={chapter.id}
              to={`/lire/${book.slug}/${chapter.number}`}
              className={`chapter-row ${chapter.unlocked ? '' : 'locked'}`}
            >
              <span className="num">{String(chapter.number).padStart(2, '0')}</span>
              <span className="title">
                <strong>{chapter.title}</strong>
                <span>
                  {chapter.isFree ? 'Offert' : chapter.unlocked ? 'Débloqué' : `${formatXof(book.priceXof)}`}
                  {chapter.words ? ` · ${chapter.words} mots` : ''}
                </span>
              </span>
              <span aria-hidden="true">{chapter.unlocked ? '→' : '🔒'}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
