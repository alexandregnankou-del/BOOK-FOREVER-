import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSite } from '../site.jsx';

export default function Auteurs() {
  const site = useSite();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    genre: 'Roman d’amour',
    payoutMethod: 'wave',
    body: '',
    acceptedTerms: false,
  });
  const [state, setState] = useState({ type: '', message: '' });
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.acceptedTerms) {
      setState({
        type: 'error',
        message: 'Veuillez accepter les conditions de publication pour envoyer votre candidature.',
      });
      return;
    }
    setBusy(true);
    setState({ type: '', message: '' });
    try {
      const formattedBody = [
        `Nom / Nom de plume : ${form.name}`,
        `E-mail : ${form.email}`,
        `WhatsApp / Téléphone : ${form.phone || 'Non renseigné'}`,
        `Titre du roman : ${form.subject || 'Sans titre'}`,
        `Genre : ${form.genre}`,
        `Moyen de versement royalties souhaité : ${form.payoutMethod === 'wave' ? 'Wave' : 'Orange Money'}`,
        `Formule acceptée : 7 500 FCFA à l'inscription (1er mois inclus), puis 5 000 FCFA/mois (déductibles des ventes), 70% de royalties nettes`,
        '',
        '--- MANUSCRIT / EXTRAITS ---',
        form.body,
      ].join('\n');

      const res = await api.contact({
        name: form.name,
        email: form.email,
        subject: `[Candidature Auteur] ${form.subject || 'Sans titre'} (${form.name})`,
        body: formattedBody,
      });
      setState({
        type: 'ok',
        message:
          res.message ||
          'Votre candidature a bien été reçue. Notre équipe éditoriale vous contactera sous 48h avec les instructions pour finaliser la publication.',
      });
      setForm({
        name: '',
        email: '',
        phone: '',
        subject: '',
        genre: 'Roman d’amour',
        payoutMethod: 'wave',
        body: '',
        acceptedTerms: false,
      });
    } catch (err) {
      setState({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="wrap">
        <div className="auteurs-hero">
          <span className="eyebrow">Espace Auteurs & Publication</span>
          <h1>Vous écrivez ?<br />Publiez et gagnez 70% sur vos ventes.</h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            Rejoignez {site.siteName} et diffusez vos romans auprès de milliers de lecteurs passionnés.
            Vos lecteurs débloquent vos chapitres par Mobile Money (Wave / Orange Money) et vous percevez
            directement <strong>70% de royalties</strong> sur chaque vente.
          </p>
        </div>

        <div className="auteurs-grid">
          <div className="panel">
            <h2>Vos avantages & Rémunération</h2>
            <ul className="auteurs-list">
              <li>
                <strong>70% de royalties nettes</strong> : Sur chaque chapitre vendu (300 FCFA), vous touchez
                70% net (210 FCFA). La plateforme prélève 30% de commission technique.
              </li>
              <li>
                <strong>Pack d’inscription unique (7 500 FCFA)</strong> : Forfait de démarrage comprenant la
                relecture éditoriale, la mise en page numérique sécurisée, l’adaptation de la couverture et <strong>votre 1er mois d’abonnement inclus</strong>.
              </li>
              <li>
                <strong>Abonnement Auteur (5 000 FCFA / mois)</strong> : Maintien de vos œuvres en ligne, diffusion web & mobile,
                accès illimité à l'atelier d'écriture et suivi de vos ventes. <em>(Ce montant peut être directement déduit de vos gains de ventes)</em>.
              </li>
              <li>
                <strong>Diffusion multi-supports</strong> : Votre livre est publié sur le site web et dans l’application mobile Android.
              </li>
              <li>
                <strong>Protection & Propriété totale</strong> : Vous conservez 100% de vos droits d’auteur.
              </li>
              <li>
                <strong>Versements réguliers</strong> : Paiement automatique de vos royalties sur votre compte Mobile Money (Wave ou Orange Money).
              </li>
            </ul>
          </div>

          <div className="panel">
            <h2>Comment se passe la publication</h2>
            <ol className="auteurs-steps">
              <li>
                <strong>Soumission</strong> : Remplissez le formulaire ci-dessous avec le résumé et les premiers chapitres de votre manuscrit.
              </li>
              <li>
                <strong>Examen éditorial</strong> : Notre comité de lecture analyse votre texte et vous répond sous 48h par e-mail ou WhatsApp.
              </li>
              <li>
                <strong>Validation & Inscription</strong> : Après accord, vous réglez les frais d’inscription de 7 500 FCFA (1er mois inclus).
              </li>
              <li>
                <strong>Mise en ligne & Revenus</strong> : Votre livre est publié, vos ventes démarrent et vous touchez vos 70% de royalties.
              </li>
            </ol>
            <p className="hint" style={{ marginTop: 14 }}>
              💡 <strong>Rentabilité rapide</strong> : À raison de 210 FCFA net par chapitre vendu, il suffit d'une vingtaine de chapitres débloqués par mois pour couvrir entièrement votre abonnement.
            </p>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 26 }}>
          <h2>Postuler pour publier un roman</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            Complétez ce formulaire pour soumettre votre œuvre. Dès validation éditoriale, les frais d’inscription de 7 500 FCFA (1er mois offert)
            activeront la mise en page et la publication officielle de votre roman.
          </p>
          <form className="form" onSubmit={submit}>
            <div className="form-row">
              <label>
                <span>Nom complet ou Nom de plume *</span>
                <input
                  value={form.name}
                  onChange={update('name')}
                  required
                  maxLength={120}
                  placeholder="Ex : Alexandre Anderson G"
                />
              </label>
              <label>
                <span>Adresse e-mail *</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  required
                  maxLength={160}
                  placeholder="votre.email@exemple.com"
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                <span>Numéro WhatsApp / Téléphone *</span>
                <input
                  value={form.phone}
                  onChange={update('phone')}
                  required
                  maxLength={40}
                  placeholder="Ex : +225 07 00 00 00 00"
                />
              </label>
              <label>
                <span>Genre de l'œuvre *</span>
                <select value={form.genre} onChange={update('genre')} className="select">
                  <option value="Roman d’amour">Roman d’amour</option>
                  <option value="Drame & Société">Drame & Société</option>
                  <option value="Destin & Famille">Destin & Famille</option>
                  <option value="Suspense / Thriller">Suspense / Thriller</option>
                  <option value="Foi & Inspiration">Foi & Inspiration</option>
                  <option value="Autre genre">Autre genre</option>
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                <span>Titre du roman *</span>
                <input
                  value={form.subject}
                  onChange={update('subject')}
                  required
                  maxLength={160}
                  placeholder="Ex : Les Mystères du Cœur"
                />
              </label>
              <label>
                <span>Moyen de paiement souhaité pour vos royalties (70%)</span>
                <select value={form.payoutMethod} onChange={update('payoutMethod')} className="select">
                  <option value="wave">Wave Mobile Money</option>
                  <option value="orange">Orange Money</option>
                </select>
              </label>
            </div>

            <label>
              <span>Résumé et extraits (les 2 ou 3 premiers chapitres) *</span>
              <textarea
                rows={10}
                value={form.body}
                onChange={update('body')}
                required
                maxLength={8000}
                placeholder="Indiquez le synopsis complet en quelques lignes, suivi du texte de vos premiers chapitres..."
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '14px 0 20px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.acceptedTerms}
                onChange={update('acceptedTerms')}
                style={{ marginTop: 4, accentColor: 'var(--gold, #c9a227)' }}
              />
              <span style={{ fontSize: '0.9rem', color: '#ded7cd' }}>
                J'atteste être l'auteur légitime de cette œuvre et j'accepte les{' '}
                <Link to="/conditions" target="_blank" style={{ color: 'var(--gold, #c9a227)' }}>
                  Conditions de publication
                </Link>{' '}
                (frais d'inscription de 7 500 FCFA avec 1er mois inclus, abonnement mensuel de 5 000 FCFA déductible des ventes et reversement de 70% des royalties sur les chapitres vendus).
              </span>
            </label>

            <button type="submit" className="btn btn-gold" disabled={busy} style={{ minWidth: 220 }}>
              {busy ? 'Envoi en cours…' : 'Envoyer ma candidature auteur'}
            </button>

            {state.message && (
              <p className={state.type === 'ok' ? 'ok' : 'error'} style={{ marginTop: 14 }}>
                {state.message}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
