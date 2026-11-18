import { useEffect, useState } from 'react';
import { api } from '../api.js';

const FIELDS = [
  ['siteName', 'Nom du site'],
  ['siteTagline', 'Signature'],
  ['contactEmail', 'E-mail public (CGU, contact, pied de page)'],
  ['contactPhone', 'Téléphone / WhatsApp public'],
  ['publisher', 'Éditeur'],
  ['address', 'Adresse'],
  ['supportHours', 'Horaires de réponse'],
];

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [providers, setProviders] = useState({});
  const [notice, setNotice] = useState({ type: '', message: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.admin
      .settings()
      .then((data) => {
        setSettings(data.settings);
        setProviders(data.providers);
      })
      .catch((err) => setNotice({ type: 'error', message: err.message }));
  }, []);

  if (!settings) return <p className="muted">Chargement…</p>;

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { settings: fresh } = await api.admin.saveSettings(settings);
      setSettings(fresh);
      setNotice({ type: 'ok', message: 'Réglages enregistrés. La page Contact et la fenêtre de paiement sont à jour.' });
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="console-head">
        <div>
          <span className="eyebrow">Configuration</span>
          <h1>Réglages</h1>
        </div>
      </div>

      {notice.message && <div className={`alert ${notice.type}`}>{notice.message}</div>}

      <form className="panel" onSubmit={save}>
        <div className="split">
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Identité &amp; contact</h2>
            {FIELDS.map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <input value={settings[key] ?? ''} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Paiement &amp; prix</h2>
            <div className="field">
              <label>Lien marchand Wave</label>
              <input value={settings.waveLink ?? ''} onChange={(e) => setSettings({ ...settings, waveLink: e.target.value })} />
            </div>
            <div className="field">
              <label>Numéro Orange Money</label>
              <input
                value={settings.orangeNumber ?? ''}
                onChange={(e) => setSettings({ ...settings, orangeNumber: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Prix du chapitre (FCFA)</label>
              <input
                type="number"
                value={settings.priceXof ?? 300}
                onChange={(e) => setSettings({ ...settings, priceXof: e.target.value })}
              />
            </div>
            <h2 style={{ fontSize: '1.1rem', margin: '18px 0 10px' }}>Formules</h2>
            <div className="field">
              <label>Pass court — prix (FCFA)</label>
              <input
                type="number"
                value={settings.passPrice ?? 500}
                onChange={(e) => setSettings({ ...settings, passPrice: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Pass court — durée (jours)</label>
              <input
                type="number"
                value={settings.passDays ?? 7}
                onChange={(e) => setSettings({ ...settings, passDays: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Pack — prix (FCFA)</label>
              <input
                type="number"
                value={settings.packPrice ?? 1200}
                onChange={(e) => setSettings({ ...settings, packPrice: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Pack — nombre de chapitres</label>
              <input
                type="number"
                value={settings.packCredits ?? 5}
                onChange={(e) => setSettings({ ...settings, packCredits: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Abonnement — prix (FCFA)</label>
              <input
                type="number"
                value={settings.monthlyPrice ?? 2000}
                onChange={(e) => setSettings({ ...settings, monthlyPrice: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Abonnement — durée (jours)</label>
              <input
                type="number"
                value={settings.monthlyDays ?? 30}
                onChange={(e) => setSettings({ ...settings, monthlyDays: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Durée d’accès à un chapitre acheté (jours)</label>
              <input
                type="number"
                value={settings.accessDays ?? 30}
                onChange={(e) => setSettings({ ...settings, accessDays: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Parrainage — amis nécessaires pour un chapitre offert</label>
              <input
                type="number"
                value={settings.referralTarget ?? 3}
                onChange={(e) => setSettings({ ...settings, referralTarget: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Parrainage — chapitres offerts par palier</label>
              <input
                type="number"
                value={settings.referralReward ?? 1}
                onChange={(e) => setSettings({ ...settings, referralReward: e.target.value })}
              />
            </div>

            <h2 style={{ fontSize: '1.1rem', margin: '18px 0 10px' }}>Titres d’auteur</h2>
            <div className="field">
              <label>Palier « confirmé » — vues minimum</label>
              <input
                type="number"
                value={settings.authorMinViews ?? 1000}
                onChange={(e) => setSettings({ ...settings, authorMinViews: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Palier « confirmé » — réactions minimum</label>
              <input
                type="number"
                value={settings.authorMinHearts ?? 100}
                onChange={(e) => setSettings({ ...settings, authorMinHearts: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Palier « confirmé » — abonnés minimum</label>
              <input
                type="number"
                value={settings.authorMinFollowers ?? 50}
                onChange={(e) => setSettings({ ...settings, authorMinFollowers: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Palier « certifié » — vues minimum</label>
              <input
                type="number"
                value={settings.authorCertViews ?? 10000}
                onChange={(e) => setSettings({ ...settings, authorCertViews: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Palier « certifié » — réactions minimum</label>
              <input
                type="number"
                value={settings.authorCertHearts ?? 1000}
                onChange={(e) => setSettings({ ...settings, authorCertHearts: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Palier « certifié » — abonnés minimum</label>
              <input
                type="number"
                value={settings.authorCertFollowers ?? 500}
                onChange={(e) => setSettings({ ...settings, authorCertFollowers: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Chapitres offerts par défaut</label>
              <input
                type="number"
                value={settings.freeChapters ?? 2}
                onChange={(e) => setSettings({ ...settings, freeChapters: e.target.value })}
              />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={settings.waveEnabled === '1'}
                  onChange={(e) => setSettings({ ...settings, waveEnabled: e.target.checked ? '1' : '0' })}
                />{' '}
                Proposer Wave
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.orangeEnabled === '1'}
                  onChange={(e) => setSettings({ ...settings, orangeEnabled: e.target.checked ? '1' : '0' })}
                />{' '}
                Proposer Orange Money
              </label>
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-gold" disabled={busy} style={{ marginTop: 12 }}>
          {busy ? 'Enregistrement…' : 'Enregistrer les réglages'}
        </button>
      </form>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 10 }}>Intégrations</h2>
        <div className="row-item">
          <div className="grow">
            <strong>Envoi des réponses par e-mail</strong>
            <span>
              {providers.resend
                ? 'Resend configuré : les réponses partent automatiquement.'
                : 'Ajoutez RESEND_API_KEY dans les variables d’environnement pour activer l’envoi.'}
            </span>
          </div>
          <span className={`pill ${providers.resend ? 'free' : 'dark'}`}>{providers.resend ? 'Actif' : 'Inactif'}</span>
        </div>
        <div className="row-item">
          <div className="grow">
            <strong>Paiement automatique Wave / Orange</strong>
            <span>
              Nécessite les clés marchandes (WAVE_API_KEY, ORANGE_CLIENT_ID…). Tant qu’elles sont absentes, chaque
              paiement est vérifié manuellement dans l’onglet Ventes.
            </span>
          </div>
          <span className="pill dark">Manuel</span>
        </div>
      </div>
    </>
  );
}
