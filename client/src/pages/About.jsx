import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatXof } from '../api.js';
import { useSite } from '../site.jsx';

export default function About() {
  const site = useSite();
  const [stats, setStats] = useState({ books: 0, chapters: 0, priceXof: null });

  useEffect(() => {
    api
      .books()
      .then(({ books }) => {
        const chapters = books.reduce((total, book) => total + (book.chaptersTotal || 0), 0);
        setStats({ books: books.length, chapters, priceXof: books[0]?.priceXof ?? null });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="page">
      <div className="wrap">
        <div className="about-hero">
          <span className="eyebrow">À propos</span>
          <h1>
            Une maison de littérature,
            <br />
            née à Abidjan.
          </h1>
          <p className="about-lead">
            {site.siteName} publie des romans en langue française et les fait lire là où les lecteurs se
            trouvent : sur un téléphone, entre deux trajets, le soir, sans carte bancaire.
          </p>
        </div>

        <div className="about-grid">
          <div className="panel">
            <h2>Ce que nous faisons</h2>
            <p>
              Nous éditons un catalogue court et exigeant — {stats.books || 'trois'} romans,{' '}
              {stats.chapters || 'trente-six'} chapitres — et nous le vendons au chapitre. Les deux premiers
              de chaque roman sont offerts : un lecteur doit pouvoir juger une écriture avant de payer.
            </p>
            <p>
              La suite coûte {formatXof(stats.priceXof || site.priceXof)} le chapitre, réglable par Wave ou
              Orange Money. Pas d’abonnement, pas de reconduction cachée : on achète ce qu’on lit.
            </p>
          </div>

          <div className="panel">
            <h2>Notre parti pris</h2>
            <ul className="auteurs-list">
              <li>
                <strong>Des histoires d’ici</strong> — amour, famille, foi, destin, écrites pour un public
                qui se reconnaît dans les personnages.
              </li>
              <li>
                <strong>Le chapitre comme unité</strong> — un prix bas, une décision simple, aucun engagement.
              </li>
              <li>
                <strong>Les auteurs à l’honneur</strong> — chaque roman porte le nom de son auteur, et le
                catalogue est ouvert à d’autres plumes.
              </li>
            </ul>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 22 }}>
          <h2>Comment ça marche</h2>
          <ol className="auteurs-steps">
            <li>Vous créez un compte avec une adresse e-mail.</li>
            <li>Vous lisez les deux premiers chapitres, gratuitement.</li>
            <li>
              Vous débloquez la suite à {formatXof(stats.priceXof || site.priceXof)} le chapitre, par Wave ou
              Orange Money ; l’éditeur valide le paiement et le chapitre s’ouvre.
            </li>
            <li>Vous reprenez votre lecture sur le téléphone ou l’application, au chapitre où vous l’avez laissée.</li>
          </ol>
          <p className="hint">
            L’application Android est disponible sur la page <Link to="/telecharger">Télécharger</Link>. Elle
            fonctionne même sans réseau pour les chapitres déjà ouverts.
          </p>
        </div>

        <div className="about-grid" style={{ marginTop: 22 }}>
          <div className="panel">
            <h2>La maison</h2>
            <p>
              {site.publisher}
              <br />
              {site.address}
            </p>
            <p className="hint">
              Édition, mise en page, couvertures et diffusion assurées par la maison. Les textes restent la
              propriété de leurs auteurs.
            </p>
          </div>
          <div className="panel">
            <h2>Nous écrire</h2>
            <p>
              <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
              <br />
              <a href={`https://wa.me/${String(site.contactPhone).replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer">
                {site.contactPhone}
              </a>
            </p>
            <p className="hint">
              Assistance : {site.supportHours}. Pour publier votre roman, écrivez-nous depuis la page{' '}
              <Link to="/auteurs">Auteurs</Link>.
            </p>
          </div>
        </div>

        <p className="about-legal">
          <Link to="/regles">Règles à respecter</Link> · <Link to="/conditions">Conditions d’utilisation</Link> ·{' '}
          <Link to="/confidentialite">Confidentialité</Link>
        </p>
      </div>
    </div>
  );
}
