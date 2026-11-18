import { useState } from 'react';
import { api } from '../api.js';
import { useSite } from '../site.jsx';

export default function Auteurs() {
  const site = useSite();
  const [form, setForm] = useState({ name: '', email: '', subject: '', body: '' });
  const [state, setState] = useState({ type: '', message: '' });
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setState({ type: '', message: '' });
    try {
      const res = await api.contact({
        name: form.name,
        email: form.email,
        subject: `Candidature auteur — ${form.subject || 'sans titre'}`,
        body: form.body,
      });
      setState({ type: 'ok', message: res.message });
      setForm({ name: '', email: '', subject: '', body: '' });
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
          <span className="eyebrow">Appel à auteurs</span>
          <h1>Vous écrivez ?<br />Publiez ici.</h1>
          <p className="muted" style={{ maxWidth: 620 }}>
            {site.siteName} ouvre son catalogue à d’autres plumes. Trois romans, trente-six chapitres, des
            lecteurs qui paient au chapitre — Wave ou Orange Money. Le prochain, c’est peut-être le vôtre.
          </p>
        </div>

        <div className="auteurs-grid">
          <div className="panel">
            <h2>Ce que vous obtenez</h2>
            <ul className="auteurs-list">
              <li>
                <strong>Publication</strong> sur le site et dans l’application Android, avec couverture,
                résumé et chapitres mis en page.
              </li>
              <li>
                <strong>Deux chapitres offerts</strong> par roman, pour accrocher le lecteur avant le
                premier achat.
              </li>
              <li>
                <strong>Paiement mobile</strong> : les chapitres se vendent à 300 FCFA, par Wave ou
                Orange Money.
              </li>
              <li>
                <strong>Aucun frais de publication</strong> : vous n’avancez rien pour être mis en ligne.
              </li>
            </ul>
          </div>

          <div className="panel">
            <h2>Comment ça marche</h2>
            <ol className="auteurs-steps">
              <li>Vous envoyez les <strong>trois premiers chapitres</strong> et un résumé.</li>
              <li>Nous lisons, et nous vous répondons par e-mail avec nos remarques.</li>
              <li>
                Si nous publions : couverture, découpage des chapitres, mise en ligne — puis vous suivez
                les ventes dans nos échanges.
              </li>
            </ol>
            <p className="hint">
              Nous privilégions les récits qui tiennent le lecteur : romans d’amour, drames, histoires de
              famille, destins. Lisez d’abord les trois romans du catalogue pour voir le ton.
            </p>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 22 }}>
          <h2>Envoyer votre manuscrit</h2>
          <form className="form" onSubmit={submit}>
            <div className="form-row">
              <label>
                <span>Votre nom</span>
                <input value={form.name} onChange={update('name')} required maxLength={120} />
              </label>
              <label>
                <span>Votre e-mail</span>
                <input type="email" value={form.email} onChange={update('email')} required maxLength={160} />
              </label>
            </div>
            <label>
              <span>Titre du roman</span>
              <input value={form.subject} onChange={update('subject')} maxLength={160} />
            </label>
            <label>
              <span>Résumé et trois premiers chapitres</span>
              <textarea
                rows={8}
                value={form.body}
                onChange={update('body')}
                required
                maxLength={5000}
                placeholder="Résumé en une dizaine de lignes, puis vos trois premiers chapitres…"
              />
            </label>
            <button type="submit" className="btn btn-gold" disabled={busy}>
              {busy ? 'Envoi…' : 'Envoyer ma candidature'}
            </button>
            {state.message && <p className={state.type === 'ok' ? 'ok' : 'error'}>{state.message}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
