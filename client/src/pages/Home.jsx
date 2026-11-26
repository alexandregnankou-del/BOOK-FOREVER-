import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, formatXof } from '../api.js';
import { useSite } from '../site.jsx';
import { useSession } from '../session.jsx';
import BookCard from '../components/BookCard.jsx';
import Spotlight from '../components/Spotlight.jsx';

const CITATIONS = [
  {
    quote: 'Pendant sept mois, j’ai vécu toute une vie avec elle dans mon esprit... Et à mon réveil, pour elle, je n’étais qu’un inconnu.',
    book: 'AMOUR PERDU',
    slug: 'amour-perdu',
  },
  {
    quote: 'Certaines larmes ne coulent pas des yeux. Elles coulent d’une plume.',
    book: 'LES LARMES D’UNE PLUME',
    slug: 'les-larmes-d-une-plume',
  },
  {
    quote: 'Quand l’amour naît dans l’ombre, il faut parfois traverser toute l’obscurité pour trouver la lumière.',
    book: 'LIGHT IN THE DARK',
    slug: 'light-in-the-dark',
  },
];

const MOOD_FILTERS = [
  { id: 'all', label: '📚 Tous les romans' },
  { id: 'amour', label: '💖 Je veux croire à l’amour', slugs: ['amour-perdu', 'si-je-t-aimais-au-present', 'pour-une-femme-que-j-aime'] },
  { id: 'larmes', label: '😭 Je veux pleurer', slugs: ['les-larmes-d-une-plume', 'pour-une-femme-que-j-aime'] },
  { id: 'suspense', label: '🔥 Je veux du suspense', slugs: ['light-in-the-dark', 'amour-perdu'] },
];

export default function Home() {
  const site = useSite();
  const { user } = useSession();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resume, setResume] = useState(null);
  const [activeMood, setActiveMood] = useState('all');
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Carrousel de citations doux (rotation toutes les 6 secondes)
  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % CITATIONS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

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

  // Roman à la une (Spotlight ou Amour Perdu par défaut)
  const spotlightBook = useMemo(() => {
    if (site.spotlight?.book) {
      const match = books.find((b) => b.slug === site.spotlight.book.slug);
      if (match) return match;
    }
    return books.find((b) => b.slug === 'amour-perdu') || books[0] || null;
  }, [books, site.spotlight]);

  // Filtrage par humeur / émotion
  const filteredBooks = useMemo(() => {
    if (activeMood === 'all') return books;
    const filter = MOOD_FILTERS.find((f) => f.id === activeMood);
    if (!filter?.slugs) return books;
    return books.filter((b) => filter.slugs.includes(b.slug));
  }, [books, activeMood]);

  const heroBook = spotlightBook || books[0];

  return (
    <div className="home-premium">
      <Spotlight spotlight={site.spotlight} />

      {/* ========================================================================= */}
      {/* SECTION 1 : HERO (L'ACCROCHE IMMERSIVE)                                   */}
      {/* ========================================================================= */}
      <section className="hero hero-premium">
        <div className="wrap hero-grid">
          <div className="hero-content">
            <span className="eyebrow eyebrow-gold">
              ✦ {site.publisher || 'ADISEN — Littérature Ivoirienne'}
            </span>
            <h1 className="hero-title">
              Certaines histoires ne se lisent pas. <br />
              <em>Elles se vivent.</em>
            </h1>
            <p className="hero-subtitle">
              Des histoires d’amour, de passion, de trahison et d’espoir. Chaque histoire mérite d’être vécue jusqu’au bout.
              Entrez dans un univers où chaque chapitre vous rapproche d’une nouvelle émotion, directement sur votre téléphone.
            </p>
            <div className="hero-actions">
              <Link to={`/lire/${heroBook?.slug || 'amour-perdu'}/1`} className="btn btn-gold btn-lg">
                ⚡ Lire le premier chapitre (Gratuit)
              </Link>
              <Link to="/bibliotheque" className="btn btn-ghost btn-lg">
                Explorer le catalogue ({books.length || 5} romans)
              </Link>
            </div>
            <div className="hero-badges">
              <span>✅ 2 chapitres offerts par roman</span>
              <span>✅ Paiement 100% Mobile Money</span>
              <span>✅ Sans application obligatoire</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-book-card">
              {heroBook && (
                <Link to={`/roman/${heroBook.slug}`}>
                  <img
                    src={heroBook.cover}
                    alt={heroBook.title}
                    className="hero-cover-img"
                    loading="eager"
                  />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 6 : REPRENDRE MA LECTURE (PERSONNALISATION)                       */}
      {/* ========================================================================= */}
      {resume ? (
        <section className="section resume-section">
          <div className="wrap">
            <div className="resume-card-premium">
              <img className="resume-cover" src={resume.book.cover} alt={resume.book.title} />
              <div className="resume-body">
                <span className="eyebrow eyebrow-gold">✦ Votre lecture en cours</span>
                <h3>{resume.book.title}</h3>
                <p className="muted">
                  Chapitre {resume.chapter.number} — {resume.chapter.title}
                </p>
                <div className="resume-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(8, Math.round((resume.position || 0) * 100))}%` }} />
                </div>
              </div>
              <Link to={`/lire/${resume.book.slug}/${resume.chapter.number}`} className="btn btn-gold">
                Reprendre ma lecture →
              </Link>
            </div>
          </div>
        </section>
      ) : !user ? (
        <section className="section resume-guest-bar">
          <div className="wrap">
            <div className="guest-resume-banner">
              <div>
                <strong>📖 Vous avez déjà commencé une histoire ?</strong>
                <p className="muted">
                  Connectez-vous en 1 clic pour reprendre votre lecture exactement là où vous vous étiez arrêté.
                </p>
              </div>
              <Link to="/connexion" className="btn btn-ghost btn-sm">
                Se connecter
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* ========================================================================= */}
      {/* SECTION 2 : ROMAN À LA UNE (LA BANDE-ANNONCE)                             */}
      {/* ========================================================================= */}
      {spotlightBook && (
        <section className="section spotlight-section">
          <div className="wrap">
            <div className="spotlight-card-premium">
              <div className="spotlight-badge-top">
                <span>⭐ À DÉCOUVRIR ABSOLUMENT</span>
              </div>
              <div className="spotlight-content-grid">
                <div className="spotlight-image-col">
                  <img
                    src={spotlightBook.cover}
                    alt={spotlightBook.title}
                    className="spotlight-cover-main"
                  />
                </div>
                <div className="spotlight-text-col">
                  <span className="eyebrow eyebrow-gold">{spotlightBook.category?.name || 'Roman Phare'}</span>
                  <h2 className="spotlight-title">{spotlightBook.title}</h2>
                  <div className="spotlight-author">Par {spotlightBook.author}</div>
                  <p className="spotlight-synopsis">{spotlightBook.synopsis}</p>

                  {/* Carrousel de citations immersives */}
                  <div className="citation-box">
                    <div className="citation-quote">« {CITATIONS[quoteIndex].quote} »</div>
                    <div className="citation-source">— Extrait de {CITATIONS[quoteIndex].book}</div>
                  </div>

                  <div className="spotlight-actions">
                    <Link to={`/lire/${spotlightBook.slug}/1`} className="btn btn-gold">
                      ⚡ Commencer ma lecture (Chapitres 1 & 2 offerts)
                    </Link>
                    <Link to={`/roman/${spotlightBook.slug}`} className="btn btn-ghost">
                      Fiche complète & Sommaire
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3 : NOS ROMANS (FILTRES PAR ÉMOTION)                              */}
      {/* ========================================================================= */}
      <section className="section catalog-section" id="catalogue">
        <div className="wrap">
          <div className="section-head text-center">
            <span className="eyebrow eyebrow-gold">✦ Le Catalogue</span>
            <h2>Quelle émotion recherchez-vous ce soir ?</h2>
            <p className="muted">Choisissez votre humeur du moment pour trouver l’histoire qui vous correspond.</p>

            {/* Boutons de filtres d'humeur */}
            <div className="mood-filters-bar">
              {MOOD_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`mood-btn ${activeMood === filter.id ? 'active' : ''}`}
                  onClick={() => setActiveMood(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="muted text-center" style={{ padding: '40px 0' }}>
              Chargement de la bibliothèque…
            </p>
          ) : (
            <div className="grid-books">
              {filteredBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 4 : LECTURE GRATUITE (LE TEASING DE CONVERSION)                    */}
      {/* ========================================================================= */}
      <section className="section teaser-section">
        <div className="wrap">
          <div className="teaser-card">
            <div className="teaser-header">
              <span className="eyebrow eyebrow-gold">✦ Deux chapitres 100% offerts</span>
              <h2>Entrez directement dans l’histoire</h2>
              <p className="muted">
                Découvrez un extrait du chapitre 2 de <em>{heroBook?.title || 'AMOUR PERDU'}</em>.
              </p>
            </div>

            <div className="teaser-preview-box">
              <div className="teaser-text-content">
                <p>
                  « Mon cœur battait à tout rompre. Je la regardais s’éloigner dans la pénombre de la rue,
                  incapable de faire un pas. Toutes ces années passées à espérer une réponse, et voilà qu’elle
                  se retournait avec ce regard que je n’oublierai jamais… »
                </p>
                <p className="blurred-text">
                  « Elle s’arrêta net au coin de l’avenue. Le vent souleva légèrement son foulard. Elle murmura ces
                  trois mots qui allaient faire basculer ma vie à tout jamais… mais un bruit sourd retentit au bout de
                  la ruelle et tout devint silence. »
                </p>
              </div>

              <div className="teaser-overlay-unlock">
                <div className="unlock-badge">🔒 Fin de l’extrait d’évaluation</div>
                <p style={{ margin: '8px 0 16px', fontSize: '0.9rem', color: '#ded7cd' }}>
                  Lisez la suite immédiatement et gratuitement sur votre téléphone.
                </p>
                <Link to={`/lire/${heroBook?.slug || 'amour-perdu'}/1`} className="btn btn-gold btn-lg">
                  ⚡ Débloquer la suite du chapitre (Gratuit)
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 5 : POURQUOI BOOK FOREVER ? (LA RÉASSURANCE)                      */}
      {/* ========================================================================= */}
      <section className="section why-section">
        <div className="wrap">
          <div className="section-head text-center">
            <span className="eyebrow eyebrow-gold">✦ Pourquoi nous choisir</span>
            <h2>Lisez en toute sérénité</h2>
            <p className="muted">Une expérience fluide pensée spécialement pour les lecteurs mobiles en Côte d’Ivoire.</p>
          </div>

          <div className="reassurance-grid">
            <div className="reassurance-card">
              <div className="reassurance-icon">💳</div>
              <h3>Paiement 100% Local</h3>
              <p>Réglez en 1 clic par <strong>Wave</strong> ou <strong>Orange Money</strong>, sans carte bancaire ni démarche complexe.</p>
            </div>

            <div className="reassurance-card">
              <div className="reassurance-icon">🔓</div>
              <h3>Aucun Abonnement Caché</h3>
              <p>Vous êtes libre : payez uniquement ce que vous lisez (300 FCFA le chapitre ou 1 500 FCFA le roman complet).</p>
            </div>

            <div className="reassurance-card">
              <div className="reassurance-icon">📱</div>
              <h3>Reprise Instantanée</h3>
              <p>Fermez votre navigateur ou l’application : votre lecture reprend automatiquement à la dernière ligne lue.</p>
            </div>

            <div className="reassurance-card">
              <div className="reassurance-icon">📜</div>
              <h3>Reçu & Accès Garanti</h3>
              <p>Chaque transaction est protégée avec un reçu officiel certifié, conforme à la loi ivoirienne n° 2013-546.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION : GRILLE TARIFAIRE TRANSPARENTE                                   */}
      {/* ========================================================================= */}
      <section className="section pricing-section">
        <div className="wrap">
          <div className="section-head text-center">
            <span className="eyebrow eyebrow-gold">✦ Nos Formules</span>
            <h2>Des prix simples et sans surprise</h2>
          </div>

          <div className="offers">
            <div className="offer">
              <span className="offer-tag">Découverte</span>
              <strong>0 FCFA</strong>
              <span className="hint">2 premiers chapitres offerts sur chaque roman</span>
              <Link to="/bibliotheque" className="btn btn-ghost btn-sm">
                Commencer
              </Link>
            </div>

            <div className="offer">
              <span className="offer-tag">À l’unité</span>
              <strong>300 FCFA</strong>
              <span className="hint">Le chapitre débloqué · accès 30 jours</span>
              <Link to="/bibliotheque" className="btn btn-ghost btn-sm">
                Choisir un roman
              </Link>
            </div>

            <div className="offer offer-best">
              <span className="offer-tag">⭐ Roman Intégral</span>
              <strong>1 500 FCFA</strong>
              <span className="hint">Tous les chapitres d’un coup · Économisez 66%</span>
              <Link to="/bibliotheque" className="btn btn-gold btn-sm">
                Prendre l’intégrale
              </Link>
            </div>

            <div className="offer">
              <span className="offer-tag">👑 Pass VIP Club</span>
              <strong>5 000 FCFA</strong>
              <span className="hint">30 jours illimité · Avant-premières & Salon privé</span>
              <Link to="/compte" className="btn btn-ghost btn-sm">
                Devenir VIP
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 7 : COMMUNAUTÉ & WHATSAPP                                         */}
      {/* ========================================================================= */}
      <section className="section community-section">
        <div className="wrap">
          <div className="community-card">
            <div className="community-content">
              <span className="eyebrow eyebrow-gold">✦ Communauté Book Forever</span>
              <h2>Rejoignez notre chaîne WhatsApp officielle</h2>
              <p>
                Ne manquez aucune sortie de nouveaux chapitres, recevez les avant-premières et échangez directement avec
                l’auteur <strong>Alexandre Anderson G.</strong>
              </p>
              <div className="community-actions">
                <a
                  href={site.channelUrl || 'https://whatsapp.com/channel/0029VbDDuHM5Ejy5yt0ylo1j'}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-whatsapp btn-lg"
                >
                  💬 Rejoindre la Chaîne WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* AVIS & PREUVE SOCIALE                                                     */}
      {/* ========================================================================= */}
      <section className="section reviews-section" style={{ background: 'rgba(255, 255, 255, 0.015)' }}>
        <div className="wrap">
          <div className="section-head text-center">
            <span className="eyebrow eyebrow-gold">✦ Témoignages</span>
            <h2>Ils ont lu Book Forever</h2>
            <p className="muted">Découvrez ce que les lecteurs ivoiriens en pensent.</p>
          </div>
          <div className="reviews-grid">
            <div className="review-card">
              <div>
                <div className="review-stars">★★★★★</div>
                <div className="review-text">« J’ai commencé Amour Perdu hier soir, je n’ai pas pu m’arrêter jusqu’au petit matin. »</div>
              </div>
              <div className="review-author">Aïcha <span className="review-location">· Abidjan</span></div>
            </div>

            <div className="review-card">
              <div>
                <div className="review-stars">★★★★★</div>
                <div className="review-text">« Enfin des histoires et des romans qui nous ressemblent vraiment, avec nos réalités. »</div>
              </div>
              <div className="review-author">Koffi <span className="review-location">· Yamoussoukro</span></div>
            </div>

            <div className="review-card">
              <div>
                <div className="review-stars">★★★★★</div>
                <div className="review-text">« Les 2 chapitres gratuits m’ont totalement convaincue. J’ai acheté toute la suite par Wave ! »</div>
              </div>
              <div className="review-author">Mariam <span className="review-location">· Bouaké</span></div>
            </div>

            <div className="review-card">
              <div>
                <div className="review-stars">★★★★★</div>
                <div className="review-text">« Des émotions intenses, une plume magnifique et le déblocage en 1 clic est super rapide. »</div>
              </div>
              <div className="review-author">Marc <span className="review-location">· San-Pédro</span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
