import { Link } from 'react-router-dom';
import { formatXof } from '../api.js';

export default function BookCard({ book }) {
  return (
    <Link to={`/roman/${book.slug}`} className="book-card">
      <div className="cover">
        <img src={book.cover} alt={`Couverture — ${book.title}`} loading="lazy" />
      </div>
      <div className="body">
        <span className="author">{book.author}</span>
        <h3>{book.title}</h3>
        {book.tagline && <p className="tagline">{book.tagline}</p>}
        <div className="meta">
          <span className="pill">{book.category?.name || 'Roman'}</span>
          <span>
            {book.chaptersFree} offerts · {formatXof(book.priceXof)}/chap.
          </span>
        </div>
      </div>
    </Link>
  );
}
