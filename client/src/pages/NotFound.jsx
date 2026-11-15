import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="legal center">
        <span className="eyebrow">404</span>
        <h1>Cette page n’existe pas</h1>
        <p className="muted">Le lien est peut-être ancien, ou le chapitre a été retiré du catalogue.</p>
        <p>
          <Link to="/bibliotheque" className="btn btn-gold">
            Retour à la bibliothèque
          </Link>
        </p>
      </div>
    </div>
  );
}
