import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatXof } from '../api.js';
import { useSite } from '../site.jsx';
import { useSession } from '../session.jsx';
import PromoRail from '../components/PromoRail.jsx';
import VideoRail from '../components/VideoRail.jsx';
import Spotlight from '../components/Spotlight.jsx';

/**
 * Résumé court : on coupe le synopsis enregistré sur une fin de phrase.
 * On ne réécrit jamais le texte de l'auteur, on le tronque.
 */
function resumeCourt(texte, max = 150) {
  const plat = String(texte || '').replace(/\s+/g, ' ').trim();
  if (plat.length <= max) return plat;
  const coupe = plat.slice(0, max);
  const fin = coupe.search(/[.!?…][^.!?…]*$/);
  if (fin > max * 0.55) return coupe.slice(0, fin + 1);
  return `${coupe.replace(/\s+\S*$/, '')}…`;
}

/** Le chapitre gratuit d'entrée de chaque roman. */
function premierChapitre(book) {
  return book?.firstChapter || 1;
}

function RomanALaUne({ book }) {
  if (!book) return null;
  const debut = premierChapitre(book);
  return (
    <section className="section une-section" id="a-la-une" aria-labelledby="une-titre">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">Roman à la une</span>
            <h2 id="une-titre">Cette semaine, commencez par celui-ci</h2>
          </div>
        </div>
        <div className="une">
          <Link to={`/roman/${book.slug}`} className="une-cover" tabIndex={-1} aria-hidden="true">
            <img src={book.cover} alt="" loading="eager" />
          </Link>
          <div className="une-body">
            <span className="une-badge">
              {book.chaptersPublished || book.chaptersTotal || 0} chapitres · {book.freeChapters ?? 2} offerts
            </span>
            <h3>{book.title}</h3>
            <p className="une-auteur">{book.author}</p>
            <p className="une-resume">{resumeCourt(book.synopsis, 340)}</p>
            <div className="une-actions">
              <Link to={`/lire/${book.slug}/${debut}`} className="btn btn-gold">
                Lire les {book.freeChapters ?? 2} premiers chapitres
              </Link>
              <Link to={`/roman/${book.slug}`} className="btn btn-ghost">
                Voir le roman
              </Link>
            </div>
            <p className="hint">
              {formatXof(book.priceXof)} le chapitre ensuite — Wave ou Orange Money.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CarteGalerie({ book }) {
  return (
    <article className="gal-card">
      <Link to={`/roman/${book.slug}`} className="gal-cover">
        <img src={book.cover} alt={`Couverture — ${book.title}`} loading="lazy" />
      </Link>
      <h3>
        <Link to={`/roman/${book.slug}`}>{book.title}</Link>
      </h3>
      <span className="gal-auteur">{book.author}</span>
      <p className="gal-court">{resumeCourt(book.synopsis, 108)}</p>
      <Link to={`/roman/${book.slug}`} className="gal-lien">
        Consulter le roman
      </Link>
    </article>
  );
}

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

  /* Le roman à la une : celui choisi dans la console s'il existe,
     sinon le plus complet du catalogue. Jamais un roman inventé. */
  const aLaUne = useMemo(() => {
    if (!books.length) return null;
    const choisi = site.spotlight?.bookSlug;
    if (choisi) {
      const trouve = books.find((book) => book.slug === choisi);
      if (trouve) return trouve;
    }
    return [...books].sort(
      (a, b) => (b.chaptersPublished || 0) - (a.chaptersPublished || 0) || a.title.localeCompare(b.title),
    )[0];
  }, [books, site.spotlight]);

  const couverturesHero = books.slice(0, 3);

  return (
    <>
      {/* 1 — Hero */}
      <section className="hero" aria-labelledby="hero-titre">
        <div className="wrap">
          <div className="hero-texte">
            <span className="eyebrow">{site.publisher}</span>
            <h1 id="hero-titre">
              Certaines histoires ne se lisent pas.
              <br />
              <em>Elles se vivent.</em>
            </h1>
            <p className="lead">
              Des histoires d’amour, de passion, de trahison et d’espoir. Entrez dans un univers où chaque
              chapitre vous rapproche d’une nouvelle émotion.
            </p>
            <div className="hero-actions">
              <Link to="/bibliotheque" className="btn">
                Découvrir les romans
              </Link>
              <Link to="/installer" className="btn btn-ghost">
                Installer sur mon téléphone
              </Link>
            </div>
            <div className="hero-note">
              <span aria-hidden="true">✦</span> Les {books[0]?.freeChapters ?? 2} premiers chapitres de chaque
              roman sont offerts — sans compte, sans paiement.
            </div>
          </div>
          <div className="hero-stack" aria-hidden="true">
            {couverturesHero.length > 0 ? (
              couverturesHero.map((book) => (
                <img key={book.id} src={book.cover} alt="" loading="eager" width="212" height="318" />
              ))
            ) : (
              <div className="hero-stack-vide" />
            )}
          </div>
        </div>
      </section>

      <Spotlight spotlight={site.spotlight} />

      {/* 2 — Roman à la une */}
      <RomanALaUne book={aLaUne} />

      {books.length > 0 && <PromoRail books={books} channelUrl={site.channelUrl || ''} />}

      {/* 3 — Nos romans */}
      <section className="section" id="romans" aria-labelledby="romans-titre">
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
              <span className="eyebrow">Nos romans</span>
              <h2 id="romans-titre">Choisissez votre histoire</h2>
              <p>Couverture, auteur et début du résumé. Le reste s’ouvre au fil de votre lecture.</p>
            </div>
            <Link to="/bibliotheque" className="btn btn-ghost btn-sm">
              Tout voir
            </Link>
          </div>

          {loading ? (
            <p className="muted">Chargement de la bibliothèque…</p>
          ) : (
            <div className="galerie">
              {books.map((book) => (
                <CarteGalerie key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4 — Lecture gratuite */}
      <section className="section accueil-gratuit" aria-labelledby="gratuit-titre">
        <div className="wrap">
          <span className="eyebrow">Sans carte, sans engagement</span>
          <h2 id="gratuit-titre">
            Les <em>{books[0]?.freeChapters ?? 2} premiers chapitres</em> sont gratuits.
          </h2>
          <p>
            Lisez le début de chaque roman avant de décider. Ensuite, {formatXof(site.priceXof)} le chapitre —
            vous ne payez que ce que vous lisez.
          </p>
          <Link to={aLaUne ? `/lire/${aLaUne.slug}/${premierChapitre(aLaUne)}` : '/bibliotheque'} className="btn btn-gold">
            Commencer à lire
          </Link>
        </div>
      </section>

      {/* 5 — Pourquoi BOOK FOREVER */}
      <section className="section" aria-labelledby="pourquoi-titre">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Pourquoi BOOK FOREVER ?</span>
              <h2 id="pourquoi-titre">Quatre raisons de rester</h2>
            </div>
          </div>
          <div className="atouts">
            <div className="atout">
              <span className="atout-ico" aria-hidden="true">
                ⌂
              </span>
              <h3>Une bibliothèque personnelle</h3>
              <p>Vos romans, vos favoris et votre historique réunis dans un seul espace.</p>
            </div>
            <div className="atout">
              <span className="atout-ico" aria-hidden="true">
                ⛨
              </span>
              <h3>Des achats sécurisés</h3>
              <p>Chaque déblocage est vérifié côté serveur, jamais dans votre navigateur.</p>
            </div>
            <div className="atout">
              <span className="atout-ico" aria-hidden="true">
                ❧
              </span>
              <h3>Une lecture progressive</h3>
              <p>Chapitre par chapitre, à votre rythme. Aucun abonnement obligatoire.</p>
            </div>
            <div className="atout">
              <span className="atout-ico" aria-hidden="true">
                ⟲
              </span>
              <h3>Vos achats dans votre compte</h3>
              <p>Reconnectez-vous sur n’importe quel appareil : vous retrouvez tout.</p>
            </div>
          </div>
        </div>
      </section>

      <VideoRail channelUrl={site.channelUrl || ''} />

      {/* 6 — Reprendre ma lecture */}
      {resume && (
        <section className="section resume-section" aria-labelledby="reprendre-titre">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow">Reprendre la lecture</span>
                <h2 id="reprendre-titre">Vous étiez ici</h2>
                <p>Le site retient votre dernière page ouverte, sur cet appareil comme sur les autres.</p>
              </div>
            </div>
            <div className="resume-card">
              <img className="resume-cover" src={resume.book.cover} alt="" />
              <div className="resume-body">
                <span className="eyebrow">Dernière lecture</span>
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

      {/* 7 — Communauté */}
      <section className="section accueil-commu" aria-labelledby="commu-titre">
        <div className="wrap">
          <span className="eyebrow">Communauté</span>
          <h2 id="commu-titre">Les nouveaux chapitres arrivent d’abord sur la chaîne.</h2>
          <p>Annonces de sortie, extraits et coulisses. Rejoignez la chaîne WhatsApp officielle de BOOK FOREVER.</p>
          {site.channelUrl && (
            <a className="btn btn-whatsapp" href={site.channelUrl} target="_blank" rel="noreferrer">
              <span aria-hidden="true">✆</span> Rejoindre la chaîne
            </a>
          )}
          <p className="hint">
            Aucun numéro à laisser, aucun groupe à rejoindre : une chaîne, vous la suivez si vous voulez.
          </p>
        </div>
      </section>

      {/* Les formules */}
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
