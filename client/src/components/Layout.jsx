import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useSite } from '../site.jsx';
import { useSession } from '../session.jsx';

export default function Layout() {
  const site = useSite();
  const { user, logout } = useSession();
  const { pathname } = useLocation();

  /* Version réellement installée, lue depuis l'application Android quand elle
     est présente. Permet de vérifier d'un coup d'œil quelle version tourne. */
  const appVersion =
    typeof window !== 'undefined' && window.BookForever && typeof window.BookForever.version === 'function'
      ? (() => {
          try {
            return window.BookForever.version();
          } catch {
            return null;
          }
        })()
      : null;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);

  /* La marge basse (place de la barre d'onglets) n'est appliquée qu'aux pages
     du site ; le lecteur et la console n'en ont pas. */
  useEffect(() => {
    document.body.classList.add('with-tabbar');
    return () => document.body.classList.remove('with-tabbar');
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="wrap bar">
          <Link to="/" className="brand">
            <img src="/icons/icon-192.png" alt="" />
            <span>{site.siteName}</span>
          </Link>
          <nav className="header-nav" style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link to="/bibliotheque" className="nav-link">Romans</Link>
            <Link to="/auteurs" className="nav-link" style={{ color: 'var(--gold, #c9a227)', fontWeight: 600 }}>
              Devenir Auteur (80% royalties)
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <p className="muted" style={{ color: '#9a9082', fontSize: '0.76rem', marginTop: 0 }}>
            {appVersion ? `Application Android ${appVersion}` : 'Version web'}
          </p>
          <div className="cols">
            <div>
              <h4>{site.siteName}</h4>
              <p className="muted" style={{ color: '#9a9082' }}>
                {site.publisher}
                <br />
                {site.address}
              </p>
              <p style={{ margin: 0 }}>
                <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
                <br />
                <a
                  href={`https://wa.me/${String(site.contactPhone).replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {site.contactPhone}
                </a>
              </p>
            </div>
            <div>
              <h4>Lire & Publier</h4>
              <div className="links">
                <Link to="/bibliotheque">Tous les romans</Link>
                <Link to="/auteurs" style={{ color: 'var(--gold, #c9a227)', fontWeight: 600 }}>
                  Espace Auteurs (Publier)
                </Link>
                <Link to="/videos">Les romans en vidéo</Link>
                <Link to="/telecharger">Télécharger l’application</Link>
                <Link to="/installer">Installer en 3 touches</Link>
                {site.channelUrl && (
                  <a href={site.channelUrl} target="_blank" rel="noreferrer">
                    Chaîne WhatsApp
                  </a>
                )}
                <Link to="/compte">Mes achats</Link>
                <Link to="/contact">Assistance</Link>
                <Link to="/a-propos">À propos</Link>
                <Link to="/regles">Règles à respecter</Link>
              </div>
            </div>
            <div>
              <h4>Informations & Légal</h4>
              <div className="links">
                <Link to="/conditions">Conditions d’utilisation</Link>
                <Link to="/confidentialite">Politique de confidentialité</Link>
                <Link to="/auteurs">Conditions auteurs (7 500 FCFA & 80% royalties)</Link>
                <Link to="/contact">Nous écrire</Link>
              </div>
            </div>
          </div>
          <div className="bottom">
            <span>
              © {new Date().getFullYear()} {site.publisher} — Tous droits réservés.
            </span>
            <span>{site.supportHours}</span>
          </div>
        </div>
      </footer>

      {/* Barre d'onglets mobile : l'application doit se tenir à une main. */}
      <nav className="tabbar" aria-label="Navigation principale">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <span className="tab-icon" aria-hidden="true">⌂</span>
          <span>Accueil</span>
        </NavLink>
        <NavLink to="/bibliotheque" className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <span className="tab-icon" aria-hidden="true">▤</span>
          <span>Romans</span>
        </NavLink>
        <NavLink to="/auteurs" className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <span className="tab-icon" aria-hidden="true">✎</span>
          <span>Auteurs</span>
        </NavLink>
        <NavLink to="/telecharger" className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <span className="tab-icon" aria-hidden="true">⤓</span>
          <span>Application</span>
        </NavLink>
        {user ? (
          <NavLink to="/compte" className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            <span className="tab-icon" aria-hidden="true">◍</span>
            <span>Compte</span>
          </NavLink>
        ) : (
          <NavLink to="/connexion" className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            <span className="tab-icon" aria-hidden="true">◍</span>
            <span>Connexion</span>
          </NavLink>
        )}
      </nav>
    </>
  );
}
