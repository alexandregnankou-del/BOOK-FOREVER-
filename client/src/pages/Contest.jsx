import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSite } from '../site.jsx';

const PRIX = 'Accès complet au roman choisi, offert';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function Contest() {
  const site = useSite();
  const [state, setState] = useState(null);
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', bookSlug: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.contest().then(setState).catch(() => setState(null));
    api
      .books()
      .then(({ books: list }) => {
        setBooks(list);
        if (list[0]) setForm((f) => ({ ...f, bookSlug: f.bookSlug || list[0].slug }));
      })
      .catch(() => setBooks([]));
  }, []);

  const remaining = state?.remaining ?? null;
  const taken = state?.directTaken ?? 0;
  const total = state?.directPlaces ?? 20;
  const progress = Math.min(100, Math.round((taken / Math.max(1, total)) * 100));

  const whatsapp = useMemo(() => {
    if (!result) return null;
    const phone = String(site.contactPhone || '').replace(/\D/g, '');
    if (!phone) return null;
    const text = `Bonjour, je participe à l'offre « 20 romans offerts » de BOOK FOREVER. Place n°${result.entry.position}, code ${result.entry.code}.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }, [result, site.contactPhone]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.contestEntry(form);
      setResult(res);
      setState((s) => (s ? { ...s, remaining: res.remaining, taken: res.total } : s));
    } catch (err) {
      if (err.payload?.entry) {
        setResult({ entry: err.payload.entry, remaining: 0 });
        setError('');
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="wrap">
      <section className="section">
        <p className="eyebrow">Offre de lancement · du {formatDate(state?.start)} au {formatDate(state?.end)}</p>
        <h1>
          20 romans offerts{' '}
          <span className="muted" style={{ fontWeight: 400, fontStyle: 'italic' }}>
            — tentez votre place
          </span>
        </h1>
        <p className="lead">
          Pour fêter l'ouverture de la bibliothèque, vingt lecteurs reçoivent le roman de leur choix,
          en entier, sans rien payer. Les vingt premières inscriptions gagnent d'office. Toutes les
          autres repartent avec une réduction de 10 %.
        </p>

        {state && (
          <div className="panel" style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '1.05rem' }}>
                {remaining > 0
                  ? `Plus que ${remaining} place${remaining > 1 ? 's' : ''} directe${remaining > 1 ? 's' : ''}`
                  : 'Les 20 places directes sont prises'}
              </strong>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {taken} / {total} attribuées · {state.taken} inscrit{state.taken > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(0,0,0,.12)', marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--gold)' }} />
            </div>
            {!state.open && (
              <p className="muted" style={{ marginTop: 10, fontSize: '0.85rem' }}>
                {Date.now() < Date.parse(state.start)
                  ? `Le formulaire ouvrira le ${formatDate(state.start)}.`
                  : `L'offre est close depuis le ${formatDate(state.end)}. Les gagnants sont annoncés le ${formatDate(state.announce)}.`}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="section">
        <h2 style={{ fontSize: '1.6rem' }}>Comment ça marche</h2>
        <ol className="steps" style={{ marginTop: 12 }}>
          <li>
            <strong>Je m'inscris avant le {formatDate(state?.end)}</strong> — nom, adresse e-mail,
            numéro de téléphone et le roman que je veux recevoir.
          </li>
          <li>
            <strong>Les 20 premiers gagnent d'office.</strong> Au-delà, l'inscription reste valable :
            si un gagnant ne répond pas sous 7 jours, sa place revient au suivant dans l'ordre des
            inscriptions.
          </li>
          <li>
            <strong>Annonce le {formatDate(state?.announce)}</strong> — sur le site et sur la chaîne
            WhatsApp. Nous appelons aussi chaque gagnant au numéro laissé.
          </li>
        </ol>
        <p className="muted" style={{ marginTop: 10, fontSize: '0.9rem' }}>
          Aucun tirage au sort n'est nécessaire : l'ordre d'inscription décide, et il est horodaté par
          le serveur. C'est plus simple à vérifier, et plus honnête.
        </p>
      </section>

      <section className="section">
        <h2 style={{ fontSize: '1.6rem' }}>Je participe</h2>

        {result ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <p className="eyebrow">Inscription enregistrée</p>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', margin: '6px 0' }}>
              Place n°{result.entry.position} — {result.entry.status === 'direct' ? 'gagnant d’office' : 'en liste d’attente'}
            </h3>
            <p>
              {result.entry.status === 'direct'
                ? `Vous faites partie des vingt : « ${result.entry.bookTitle || 'votre roman'} » vous sera ouvert le ${formatDate(state?.announce)}.`
                : "Vous êtes inscrit. Si une place se libère, elle vous revient dans l'ordre des inscriptions."}
            </p>
            <p style={{ marginTop: 10 }}>
              Votre code : <strong style={{ letterSpacing: '.08em' }}>{result.entry.code}</strong>
              <br />
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Il vous donne aussi −10 % sur tout achat pendant 30 jours.
              </span>
            </p>
            {whatsapp && (
              <p style={{ marginTop: 14 }}>
                <a className="btn btn-whatsapp btn-sm" href={whatsapp} target="_blank" rel="noreferrer">
                  Envoyer mon code sur WhatsApp
                </a>
              </p>
            )}
            <p style={{ marginTop: 12 }}>
              <Link className="btn btn-ghost btn-sm" to="/bibliotheque">
                Lire les deux premiers chapitres gratuits
              </Link>
            </p>
          </div>
        ) : (
          <form className="panel" onSubmit={submit} style={{ marginTop: 12 }}>
            <label>
              Nom complet
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
                required
              />
            </label>
            <label>
              Adresse e-mail
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Numéro de téléphone (WhatsApp de préférence)
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="07 00 00 00 00"
                autoComplete="tel"
                required
              />
            </label>
            <label>
              Roman souhaité
              <select value={form.bookSlug} onChange={(e) => setForm({ ...form, bookSlug: e.target.value })} required>
                {books.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.title} — {b.author}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted" style={{ fontSize: '0.82rem' }}>
              {PRIX}, sans frais de port : tout se passe sur votre téléphone. Une seule inscription
              par adresse e-mail.
            </p>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-gold" type="submit" disabled={busy || (state && !state.open)}>
              {busy ? 'Enregistrement…' : state && !state.open ? 'Formulaire fermé' : 'Je participe'}
            </button>
          </form>
        )}
      </section>

      <section className="section">
        <div className="panel">
          <p className="eyebrow">Pour tous ceux qui ne gagnent pas</p>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', margin: '6px 0' }}>
            −10 % sur votre prochain achat
          </h3>
          <p>
            Chaque participant reçoit un code de réduction de 10 %, valable 30 jours à compter de
            l'annonce des résultats, sur un chapitre, un pack ou un roman complet. Non cumulable avec
            une autre offre.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 style={{ fontSize: '1.4rem' }}>Règlement de l'offre</h2>
        <div className="muted" style={{ fontSize: '0.88rem', lineHeight: 1.65 }}>
          <p>
            <strong>Organisateur.</strong> ADISEN — section Littérature, Abidjan, Côte d'Ivoire,
            éditrice du site BOOK FOREVER.
          </p>
          <p>
            <strong>Dates.</strong> Du {formatDate(state?.start)} à 00h00 au {formatDate(state?.end)} à
            23h59, heure d'Abidjan. Annonce des résultats le {formatDate(state?.announce)}.
          </p>
          <p>
            <strong>Participation.</strong> Ouverte aux personnes de 18 ans et plus, en Côte d'Ivoire
            et dans la diaspora, disposant d'une adresse e-mail valide. Une seule participation par
            personne et par adresse e-mail. La participation implique l'acceptation du présent
            règlement.
          </p>
          <p>
            <strong>Désignation des gagnants.</strong> Les vingt premières inscriptions enregistrées,
            par ordre d'horodatage serveur, sont gagnantes d'office. Aucun tirage au sort n'est
            organisé. En cas de renoncement ou d'absence de réponse sous 7 jours, la place est
            attribuée au participant suivant dans l'ordre des inscriptions.
          </p>
          <p>
            <strong>Dotation.</strong> Un accès complet au roman choisi, pendant 90 jours, activé sur
            le compte du gagnant. Lot non échangeable, non remboursable et non convertible en
            espèces.
          </p>
          <p>
            <strong>Lot de consolation.</strong> Réduction de 10 % pour chaque participant non
            gagnant, valable 30 jours à compter de l'annonce des résultats.
          </p>
          <p>
            <strong>Données personnelles.</strong> Nom, e-mail et téléphone servent uniquement à
            gérer l'offre et à contacter les gagnants. Ils ne sont ni vendus ni cédés. Vous pouvez
            demander leur suppression à tout moment en écrivant à{' '}
            <a href={`mailto:${site.contactEmail || 'contact@adisen.ci'}`}>{site.contactEmail || 'contact@adisen.ci'}</a>.
          </p>
          <p>
            <strong>Modification.</strong> L'organisateur peut prolonger, suspendre ou annuler l'offre
            en cas de force majeure, sans engager sa responsabilité ; toute modification sera annoncée
            sur cette page.
          </p>
          <p>
            <strong>Réclamations.</strong> Par WhatsApp au {site.contactPhone}, du lundi au samedi, de
            8h à 20h.
          </p>
        </div>
      </section>
      </div>
    </div>
  );
}
