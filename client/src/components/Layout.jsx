import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useSite } from '../site.jsx';
import { useSession } from '../session.jsx';

export default function Layout() {
  const site = useSite();
  const { user, logout } = useSession();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);

  return (
    <>
      <header className="site-header">
        <div className="wrap bar">
          <Link to="/" className="brand">
            <img src="/icons/icon-192.png" alt="" />
            <span>
              {site.siteName}
              <small>{site.siteTagline}</small>
            </span>
          </Link>
          <nav className="nav">
            <NavLink to="/bibliotheque" className={({ isActive }) => (isActive ? 'active' : '')}>
              Bibliothèque
            </NavLink>
            <NavLink to="/installer" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="hide-sm">Installer</span>
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="hide-sm">Aide</span>
            </NavLink>
            {user ? (
              <>
                <NavLink to="/compte" className={({ isActive }) => (isActive ? 'active' : '')}>
                  Mon compte
                </NavLink>
                {user.role === 'admin' && <NavLink to="/console">Console</NavLink>}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    await logout();
                    window.location.href = '/';
                  }}
                >
                  Quitter
                </button>
              </>
            ) : (
              <NavLink to="/connexion" className="btn btn-sm btn-gold">
                Connexion
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="wrap">
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
              <h4>Lire</h4>
              <div className="links">
                <Link to="/bibliotheque">Tous les romans</Link>
                <Link to="/installer">Installer l’application</Link>
                <Link to="/compte">Mes achats</Link>
                <Link to="/contact">Assistance</Link>
              </div>
            </div>
            <div>
              <h4>Informations</h4>
              <div className="links">
                <Link to="/conditions">Conditions d’utilisation</Link>
                <Link to="/confidentialite">Politique de confidentialité</Link>
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
    </>
  );
}
