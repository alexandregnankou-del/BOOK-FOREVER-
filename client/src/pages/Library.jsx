import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import BookCard from '../components/BookCard.jsx';
import { useSession } from '../session.jsx';

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function Library() {
  const { user } = useSession();
  const [books, setBooks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Tout');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .books()
      .then(({ books: list }) => setBooks(list))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }
    api
      .favorites()
      .then(({ slugs }) => setFavorites(slugs || []))
      .catch(() => setFavorites([]));
  }, [user]);

  const categories = useMemo(
    () => ['Tout', ...new Set(books.map((b) => b.category?.name).filter(Boolean))],
    [books],
  );

  useEffect(() => {
    if (filter !== 'Tout' && !categories.includes(filter) && filter !== 'Mes favoris') setFilter('Tout');
  }, [categories, filter]);

  const visible = useMemo(() => {
    const search = normalize(query).trim();
    return books.filter((book) => {
      if (filter === 'Mes favoris' && !favorites.includes(book.slug)) return false;
      if (filter !== 'Tout' && filter !== 'Mes favoris' && book.category?.name !== filter) return false;
      if (!search) return true;
      return normalize(`${book.title} ${book.author} ${book.tagline} ${book.category?.name}`).includes(search);
    });
  }, [books, favorites, filter, query]);

  const tabs = user ? ['Tout', 'Mes favoris', ...categories.slice(1)] : categories;

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <span className="eyebrow">Bibliothèque</span>
          <h1>Choisissez votre prochaine histoire</h1>
          <p className="muted">Deux chapitres offerts par roman — aucune inscription nécessaire pour commencer.</p>
        </div>

        <div className="library-tools">
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Titre, auteur, thème…"
              aria-label="Rechercher un roman"
            />
            {query && (
              <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Effacer">
                ×
              </button>
            )}
          </label>
          <span className="muted library-count">
            {visible.length} roman{visible.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="tabs">
          {tabs.map((category) => (
            <button
              key={category}
              type="button"
              className={filter === category ? 'active' : ''}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="muted">Chargement…</p>
        ) : visible.length === 0 ? (
          <div className="empty">
            {filter === 'Mes favoris' ? (
              <>
                <p>Aucun roman dans vos favoris pour l’instant.</p>
                <p className="muted" style={{ fontSize: '0.9rem' }}>
                  Ouvrez une fiche roman et touchez le cœur pour la garder ici.
                </p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilter('Tout')}>
                  Parcourir le catalogue
                </button>
              </>
            ) : (
              <>
                <p>Aucun roman ne correspond à « {query} ».</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuery('')}>
                  Effacer la recherche
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid-books">
            {visible.map((book) => (
              <BookCard key={book.id} book={book} favorite={favorites.includes(book.slug)} />
            ))}
          </div>
        )}

        {!user && (
          <p className="muted center" style={{ marginTop: 26, fontSize: '0.9rem' }}>
            <Link to="/connexion">Connectez-vous</Link> pour enregistrer vos favoris et reprendre vos lectures.
          </p>
        )}
      </div>
    </div>
  );
}
