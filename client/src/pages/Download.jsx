import { Link } from 'react-router-dom';
import { useSite } from '../site.jsx';

export default function Download() {
  const site = useSite();

  return (
    <div className="wrap">
      <section className="page-head">
        <span className="eyebrow">Application mobile</span>
        <h1>BOOK FOREVER dans votre poche</h1>
        <p className="muted">
          Une application légère (100 Ko) qui réunit tout : la bibliothèque, les chapitres offerts,
          le lecteur, vos achats et votre compte. Aucun magasin d’applications, aucun compte Google
          nécessaire.
        </p>
      </section>

      <div className="download-grid">
        <div className="card download-card">
          <div className="dl-icon">▲</div>
          <h2>Android</h2>
          <p className="muted">
            Fichier <code>book-forever-v8.apk</code> (version 8.0.0, 103 Ko) — compatible Android 7 et plus récent. Si une ancienne version est installée, désinstallez-la d’abord.
          </p>
          <a className="btn btn-gold btn-block" href="/download/book-forever-v8.apk" download>
            Télécharger l’application
          </a>
          <ol className="steps">
            <li>Touchez le bouton ci-dessus : le fichier se télécharge.</li>
            <li>Ouvrez-le depuis vos notifications ou <em>Fichiers → Téléchargements</em>.</li>
            <li>
              Android demande d’autoriser l’installation : <em>Paramètres → Autoriser depuis cette
              source</em>, puis <em>Installer</em>.
            </li>
            <li>L’icône BOOK FOREVER apparaît sur votre écran d’accueil.</li>
          </ol>
          <p className="hint">
            Si vous préférez ne rien installer, le site fonctionne aussi très bien dans le
            navigateur : <Link to="/installer">voir l’installation rapide</Link>.
          </p>
        </div>

        <div className="card download-card">
          <div className="dl-icon">✦</div>
          <h2>iPhone / iPad</h2>
          <p className="muted">
            Apple n’autorise pas l’installation directe d’un fichier. L’application s’ajoute en
            trois touches, avec la même icône et le même fonctionnement.
          </p>
          <ol className="steps">
            <li>Ouvrez ce site dans <strong>Safari</strong>.</li>
            <li>Touchez le bouton <strong>Partager</strong> (carré avec une flèche).</li>
            <li>Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.</li>
          </ol>
          <Link to="/installer" className="btn btn-outline btn-block">
            Guide d’installation illustré
          </Link>
          <p className="hint">
            Une version iPhone empaquetée nécessiterait un compte développeur Apple (99 $/an).
            L’ajout à l’écran d’accueil donne le même résultat, gratuitement.
          </p>
        </div>
      </div>

      <section className="card download-card wide">
        <h2>Ce que contient l’application</h2>
        <ul className="checklist">
          <li>Les trois romans et leurs 36 chapitres, avec les deux premiers offerts par livre.</li>
          <li>Le lecteur réglé pour le téléphone : taille de texte, thème sombre, reprise de lecture.</li>
          <li>Vos achats et votre progression, conservés d’une session à l’autre.</li>
          <li>Paiement par Wave ou Orange Money, puis déblocage immédiat du chapitre.</li>
          <li>La page de contact pour joindre l’éditeur en un geste.</li>
        </ul>
        <p className="hint">
          Support : {site.contactEmail} — {site.contactPhone}
        </p>
        <p className="hint" style={{ marginTop: 14 }}>
          Pour héberger le site ailleurs ou l’archiver :{' '}
          <a href="/download/book-forever-web-1.8.0.zip" download>
            archive web 1.8.0
          </a>
          .
        </p>
      </section>
    </div>
  );
}
