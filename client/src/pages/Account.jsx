import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatDate, formatXof, METHOD_LABELS, STATUS_LABELS } from '../api.js';
import { useSession } from '../session.jsx';

export default function Account() {
  const { user, ready, logout } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState('lectures');
  const [purchases, setPurchases] = useState([]);
  const [reading, setReading] = useState([]);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [subscription, setSubscription] = useState(null);
  const [author, setAuthor] = useState(null);
  const [authorForm, setAuthorForm] = useState({ penName: '', bio: '' });
  const [subBusy, setSubBusy] = useState(false);
  const [audience, setAudience] = useState(null);

  useEffect(() => {
    if (ready && !user) navigate('/connexion?next=/compte');
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!user) return;
    api.purchases().then(({ purchases: list }) => setPurchases(list)).catch(() => {});
    api.progress().then(({ reading: list }) => setReading(list)).catch(() => {});
    api.subscription().then(setSubscription).catch(() => {});
    api.authorStatus().then(setAuthor).catch(() => {});
    api.audience().then(setAudience).catch(() => {});
  }, [user]);

  if (!ready || !user) return <p className="empty">Chargement…</p>;

  const submitPassword = async (event) => {
    event.preventDefault();
    setFeedback({ type: '', message: '' });
    try {
      await api.changePassword(passwords);
      setFeedback({ type: 'ok', message: 'Mot de passe mis à jour.' });
      setPasswords({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const subscribe = async () => {
    setSubBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.subscribe({ method: 'wave_link' });
      setFeedback({ type: 'ok', message: res.message });
      api.subscription().then(setSubscription).catch(() => {});
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubBusy(false);
    }
  };

  const applyAuthor = async (event) => {
    event.preventDefault();
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.applyAuthor(authorForm);
      setFeedback({ type: 'ok', message: res.message });
      api.authorStatus().then(setAuthor).catch(() => {});
    api.audience().then(setAudience).catch(() => {});
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <span className="eyebrow">Mon compte</span>
          <h1>{user.name || user.email}</h1>
          <p className="muted">{user.email}</p>
        </div>

        {feedback.message && (
          <p className={feedback.type === 'ok' ? 'ok' : 'error'} style={{ marginBottom: 14 }}>
            {feedback.message}
          </p>
        )}

        <div className="about-grid" style={{ marginBottom: 22 }}>
          <div className="panel">
            <div className="sub-status">
              <h2 style={{ margin: 0 }}>Abonnement</h2>
              {subscription?.active ? (
                <span className="badge-author">Actif</span>
              ) : subscription?.subscription?.status === 'pending' ? (
                <span className="hint">En attente de validation</span>
              ) : null}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              {formatXof(subscription?.priceXof || 2000)} par mois — tout le catalogue, sans compter. Sans
              engagement.
            </p>
            {subscription?.active ? (
              <p>
                Valable jusqu’au <strong>{formatDate(subscription.subscription.period_end)}</strong>.
              </p>
            ) : subscription?.subscription?.status === 'pending' ? (
              <p className="hint">Nous vérifions votre transfert Wave ou Orange Money. Activation sous 24 h.</p>
            ) : (
              <button className="btn btn-gold" onClick={subscribe} disabled={subBusy}>
                {subBusy ? 'Envoi…' : 'S’abonner — 2 000 FCFA / mois'}
              </button>
            )}
          </div>

          <div className="panel">
            <div className="sub-status">
              <h2 style={{ margin: 0 }}>Statut d’auteur</h2>
              {author?.status === 'approved' && <span className="badge-author">Auteur</span>}
            </div>
            {author?.status === 'approved' ? (
              <>
                <p style={{ marginTop: 8 }}>
                  Vous écrivez sous le nom de <strong>{author.penName}</strong>.
                </p>
                <Link className="btn btn-ghost btn-sm" to="/ecrire">
                  Ouvrir mon atelier →
                </Link>
              </>
            ) : author?.status === 'pending' ? (
              <p className="hint">Votre candidature est en cours d’examen.</p>
            ) : (
              <form className="form" onSubmit={applyAuthor}>
                <label>
                  <span>Nom de plume</span>
                  <input
                    value={authorForm.penName}
                    onChange={(e) => setAuthorForm({ ...authorForm, penName: e.target.value })}
                    required
                    maxLength={80}
                  />
                </label>
                <label>
                  <span>Votre projet</span>
                  <textarea
                    rows={3}
                    value={authorForm.bio}
                    onChange={(e) => setAuthorForm({ ...authorForm, bio: e.target.value })}
                    required
                    minLength={40}
                    maxLength={1200}
                    placeholder="Quelques lignes sur vous et le roman que vous voulez écrire."
                  />
                </label>
                <button className="btn btn-ghost btn-sm" type="submit">
                  Demander le statut d’auteur
                </button>
              </form>
            )}
          </div>
        </div>

        {audience && (
          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="sub-status">
              <h2 style={{ margin: 0 }}>Mon audience</h2>
              {audience.level !== 'en cours' ? (
                <span className="badge-author">Auteur {audience.level}</span>
              ) : (
                <span className="hint">Titre d’auteur : conditions non atteintes</span>
              )}
            </div>
            {audience.nextLevel && (
              <p className="hint" style={{ marginTop: 6 }}>
                Prochain palier : <strong>{audience.nextLevel}</strong>
              </p>
            )}
            <div className="audience-grid">
              {[
                ['Vues', audience.views, audience.thresholds.views, audience.progress.views],
                ['Réactions', audience.hearts, audience.thresholds.hearts, audience.progress.hearts],
                ['Abonnés', audience.followers, audience.thresholds.followers, audience.progress.followers],
              ].map(([label, value, target, percent]) => (
                <div key={label} className="audience-item">
                  <span className="hint">{label}</span>
                  <strong>{value.toLocaleString('fr-FR')}</strong>
                  <span className="hint">sur {target.toLocaleString('fr-FR')}</span>
                  <div className="audience-track">
                    <div className="audience-fill" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="tabs">
          <button type="button" className={tab === 'lectures' ? 'active' : ''} onClick={() => setTab('lectures')}>
            Reprendre la lecture
          </button>
          <button type="button" className={tab === 'achats' ? 'active' : ''} onClick={() => setTab('achats')}>
            Mes achats
          </button>
          <button type="button" className={tab === 'securite' ? 'active' : ''} onClick={() => setTab('securite')}>
            Mot de passe
          </button>
          {user.role === 'admin' && (
            <Link to="/console" style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '0.86rem' }}>
              Console d’administration →
            </Link>
          )}
        </div>

        {tab === 'lectures' && (
          <div className="panel">
            {reading.length === 0 ? (
              <p className="empty">Aucune lecture en cours. <Link to="/bibliotheque">Choisir un roman</Link></p>
            ) : (
              reading.map((item) => (
                <div className="row-item" key={`${item.book.slug}-${item.chapter.number}`}>
                  <img src={item.book.cover} alt="" />
                  <div className="grow">
                    <strong>{item.book.title}</strong>
                    <span>
                      Chapitre {item.chapter.number} · {item.chapter.title} — {formatDate(item.updatedAt)}
                    </span>
                  </div>
                  <Link to={`/lire/${item.book.slug}/${item.chapter.number}`} className="btn btn-ghost btn-sm">
                    Reprendre
                  </Link>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'achats' && (
          <div className="panel">
            {pendingOrders().length > 0 && (
              <div className="row-item" style={{ borderColor: 'rgba(201,162,39,.45)' }}>
                <div className="grow">
                  <strong>{pendingOrders().length} paiement(s) en attente d’envoi</strong>
                  <span>Enregistré(s) hors ligne. Envoi automatique dès le retour du réseau.</span>
                </div>
              </div>
            )}
            {purchases.length === 0 ? (
              <p className="empty">Aucun achat pour le moment.</p>
            ) : (
              purchases.map((order) => (
                <div className="row-item" key={order.id}>
                  <img src={order.book.cover} alt="" />
                  <div className="grow">
                    <strong>
                      {order.book.title} — chapitre {order.chapter.number}
                    </strong>
                    <span>
                      {order.reference} · {METHOD_LABELS[order.method] || order.method} ·{' '}
                      {formatXof(order.amountXof)} · {formatDate(order.createdAt)}
                    </span>
                  </div>
                  {order.status === 'paid' ? (
                    <Link to={`/lire/${order.book.slug}/${order.chapter.number}`} className="btn btn-gold btn-sm">
                      Lire
                    </Link>
                  ) : (
                    <span className={`pill ${order.status === 'pending' ? '' : 'warn'}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'securite' && (
          <div className="panel" style={{ maxWidth: 460 }}>
            {feedback.message && <div className={`alert ${feedback.type}`}>{feedback.message}</div>}
            <form onSubmit={submitPassword}>
              <div className="field">
                <label htmlFor="current">Mot de passe actuel</label>
                <input
                  id="current"
                  type="password"
                  required
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="next">Nouveau mot de passe</label>
                <input
                  id="next"
                  type="password"
                  required
                  minLength={8}
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-gold">
                Enregistrer
              </button>
            </form>
            <p style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
              >
                Se déconnecter
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
