import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatXof } from '../api.js';
import { useSite } from '../site.jsx';
import { useSession } from '../session.jsx';
import BookCard from '../components/BookCard.jsx';
import PromoRail from '../components/PromoRail.jsx';

export default function Home() {
  const site = useSite();
  const { user } = useSession();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resume, setResume] = useState(null);

  useEffect(() => {
    if (!user) {
      setResume(null);
      return;
    }
    api
      .overview()
      .then((data) => setResume(data.lastRead || null))
      .catch(() => setResume(null));
  }, [user]);

  useEffect(() => {
    api
      .books()
      .then(({ books: list }) => setBooks(list))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  const featured = books.slice(0, 3);

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">{site.publisher}</span>
            <h1>
              Chaque histoire mérite
              <br />
              d’être <em>lue jusqu’au bout.</em>
            </h1>
            <p className="lead">
              Les deux premiers chapitres sont offerts. La suite s’ouvre pour {formatXof(site.priceXof)} par
              chapitre, avec Wave ou Orange Money — ou par un pass de {site.offers?.pass?.days || 7} jours et un
              pack de {site.offers?.pack?.credits || 5} chapitres si vous lisez beaucoup. Aucun engagement.
            </p>
            <div className="hero-actions">
              <Link to="/bibliotheque" className="btn">
                Découvrir la bibliothèque
              </Link>
              <Link to="/installer" className="btn btn-ghost">
                Installer sur mon téléphone
              </Link>
            </div>
            <div className="hero-note">
              <span>✦</span> Lecture sur téléphone, tablette et ordinateur — sans application obligatoire.
            </div>
          </div>
          <div className="hero-stack">
            {(featured.length ? featured : [{ cover: '/media/covers/light-in-the-dark.webp' }, { cover: '/media/covers/les-larmes.webp' }])
              .slice(0, 2)
              .map((book, i) => (
                <img key={i} src={book.cover} alt="" />
              ))}
          </div>
        </div>
      </section>

      {books.length > 0 && <PromoRail books={books} channelUrl={site.channelUrl || ''} />}

      {resume && (
        <section className="section resume-section">
          <div className="wrap">
            <div className="resume-card">
              <img className="resume-cover" src={resume.book.cover} alt="" />
              <div className="resume-body">
                <span className="eyebrow">Reprendre la lecture</span>
                <h3>{resume.book.title}</h3>
                <p className="muted">
                  Chapitre {resume.chapter.number} — {resume.chapter.title}
                </p>
                <div className="resume-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(4, Math.round((resume.position || 0) * 100))}%` }} />
                </div>
              </div>
              <Link to={`/lire/${resume.book.slug}/${resume.chapter.number}`} className="btn btn-gold">
                Continuer
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap">

          {books.length > 0 && (
            <div className="catalogue-band">
              <div className="band-item">
                <strong>{books.length}</strong>
                <span>romans</span>
              </div>
              <div className="band-item">
                <strong>{books.reduce((total, book) => total + (book.chaptersTotal || 0), 0)}</strong>
                <span>chapitres</span>
              </div>
              <div className="band-item">
                <strong>{formatXof(books[0]?.priceXof)}</strong>
                <span>le chapitre</span>
              </div>
              <div className="band-item">
                <strong>{books[0]?.freeChapters ?? 2}</strong>
                <span>offerts par roman</span>
              </div>
            </div>
          )}

          <div className="section-head">
            <div>
              <span className="eyebrow">Le catalogue</span>
              <h2>Les romans d’Alexandre Anderson G</h2>
              <p>Trois univers : la foi qui soutient, les secrets de famille, l’amour qui traverse l’obscurité.</p>
            </div>
            <Link to="/bibliotheque" className="btn btn-ghost btn-sm">
              Tout voir
            </Link>
          </div>
          {loading ? (
            <p className="muted">Chargement de la bibliothèque…</p>
          ) : (
            <div className="grid-books">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Les formules</span>
              <h2>Payez au rythme de votre lecture</h2>
              <p>
                Un seul transfert Wave ou Orange Money par formule. Chaque chapitre acheté reste ouvert{' '}
                {site.accessDays || 30} jours.
              </p>
            </div>
          </div>
          <div className="offers">
            <div className="offer">
              <span className="offer-tag">Finir un roman</span>
              <strong>{formatXof(site.offers?.pass?.priceXof || 500)}</strong>
              <span className="hint">
                Pass {site.offers?.pass?.days || 7} jours — tout le catalogue ouvert
              </span>
              <Link to="/compte" className="btn btn-ghost btn-sm">
                Prendre le pass
              </Link>
            </div>
            <div className="offer offer-best">
              <span className="offer-tag">Le meilleur prix</span>
              <strong>{formatXof(site.offers?.pack?.priceXof || 1200)}</strong>
              <span className="hint">
                {site.offers?.pack?.credits || 5} chapitres au choix —{' '}
                {formatXof(
                  Math.round((site.offers?.pack?.priceXof || 1200) / (site.offers?.pack?.credits || 5)),
                )}{' '}
                le chapitre
              </span>
              <Link to="/compte" className="btn btn-gold btn-sm">
                Prendre le pack
              </Link>
            </div>
            <div className="offer">
              <span className="offer-tag">Grands lecteurs</span>
              <strong>{formatXof(site.offers?.monthly?.priceXof || 2000)}</strong>
              <span className="hint">
                Abonnement {site.offers?.monthly?.days || 30} jours — tout le catalogue
              </span>
              <Link to="/compte" className="btn btn-ghost btn-sm">
                S’abonner
              </Link>
            </div>
          </div>
          <p className="hint" style={{ marginTop: 14 }}>
            Les deux premiers chapitres de chaque roman restent offerts, sans compte ni paiement.
          </p>
        </div>
      </section>

      <section className="quote-band">
        <div className="wrap">
          <blockquote>« Certaines larmes ne coulent pas des yeux. Elles coulent d’une plume. »</blockquote>
          <p className="muted" style={{ marginTop: 12 }}>
            <em>Les Larmes d’une Plume</em>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Comment ça marche</span>
              <h2>Trois étapes, aucune complication</h2>
            </div>
          </div>
          <div className="steps">
            <div className="step">
              <div className="n">01</div>
              <h3>Lisez gratuitement</h3>
              <p>Les deux premiers chapitres de chaque roman sont ouverts sans compte ni paiement.</p>
            </div>
            <div className="step">
              <div className="n">02</div>
              <h3>Débloquez la suite</h3>
              <p>
                {formatXof(site.priceXof)} le chapitre. Payez par Wave (lien marchand) ou Orange Money (
                {site.orangeNumber}), en indiquant la référence affichée.
              </p>
            </div>
            <div className="step">
              <div className="n">03</div>
              <h3>Continuez où vous étiez</h3>
              <p>Vos chapitres achetés restent accessibles, et la lecture reprend à la dernière page ouverte.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
