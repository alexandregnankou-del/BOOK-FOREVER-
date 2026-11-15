import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import BookCard from '../components/BookCard.jsx';

export default function Library() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Tout');

  useEffect(() => {
    api
      .books()
      .then(({ books: list }) => setBooks(list))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ['Tout', ...new Set(books.map((b) => b.category?.name).filter(Boolean))], [books]);
  const visible = filter === 'Tout' ? books : books.filter((b) => b.category?.name === filter);

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <span className="eyebrow">Bibliothèque</span>
          <h1>Choisissez votre prochaine histoire</h1>
          <p className="muted">Deux chapitres offerts par roman — aucune inscription nécessaire pour commencer.</p>
        </div>

        <div className="tabs">
          {categories.map((category) => (
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
          <p className="empty">Aucun roman publié pour le moment.</p>
        ) : (
          <div className="grid-books">
            {visible.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
