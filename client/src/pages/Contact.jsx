import { useState } from 'react';
import { api } from '../api.js';
import { useSite } from '../site.jsx';

export default function Contact() {
  const site = useSite();
  const [form, setForm] = useState({ name: '', email: '', subject: '', body: '' });
  const [state, setState] = useState({ type: '', message: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setState({ type: '', message: '' });
    try {
      const res = await api.contact(form);
      setState({ type: 'ok', message: res.message });
      setForm({ name: '', email: '', subject: '', body: '' });
    } catch (err) {
      setState({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const whatsapp = `https://wa.me/${String(site.contactPhone).replace(/[^\d]/g, '')}`;

  return (
    <div className="page">
      <div className="wrap">
        <div className="split" style={{ alignItems: 'start' }}>
          <div>
            <span className="eyebrow">Assistance</span>
            <h1 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.7rem)', margin: '8px 0 14px' }}>
              Une question, un paiement à vérifier ?
            </h1>
            <p className="muted">
              Écrivez-nous : chaque message arrive directement dans la console de l’éditeur. Réponse sous 24 h
              ouvrées ({site.supportHours}).
            </p>

            <div className="panel" style={{ marginTop: 20 }}>
              <div className="row-item">
                <div className="grow">
                  <strong>WhatsApp / téléphone</strong>
                  <span>{site.contactPhone}</span>
                </div>
                <a href={whatsapp} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                  Écrire
                </a>
              </div>
              <div className="row-item">
                <div className="grow">
                  <strong>E-mail</strong>
                  <span>{site.contactEmail}</span>
                </div>
                <a href={`mailto:${site.contactEmail}`} className="btn btn-ghost btn-sm">
                  Envoyer
                </a>
              </div>
              <div className="row-item">
                <div className="grow">
                  <strong>Éditeur</strong>
                  <span>
                    {site.publisher} — {site.address}
                  </span>
                </div>
              </div>
            </div>

            <p className="muted" style={{ fontSize: '0.82rem', marginTop: 16 }}>
              Pour un paiement Wave ou Orange Money, indiquez toujours la référence affichée (ex.{' '}
              <span className="reference" style={{ fontSize: '0.8rem', padding: '2px 8px' }}>
                BF-2026-XXXX
              </span>
              ) : c’est elle qui permet de retrouver votre règlement.
            </p>
          </div>

          <form className="panel" onSubmit={submit}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: 14 }}>Écrire à l’éditeur</h2>
            {state.message && <div className={`alert ${state.type}`}>{state.message}</div>}
            <div className="field">
              <label htmlFor="name">Votre nom</label>
              <input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="email">Votre e-mail</label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="subject">Objet</label>
              <input
                id="subject"
                placeholder="Paiement, accès à un chapitre, question…"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="body">Message</label>
              <textarea id="body" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-gold btn-block" disabled={busy}>
              {busy ? 'Envoi…' : 'Envoyer le message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
