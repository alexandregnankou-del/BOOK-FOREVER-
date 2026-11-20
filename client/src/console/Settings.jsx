import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useSite } from '../site.jsx';

const FIELDS = [
  ['siteName', 'Nom du site'],
  ['siteTagline', 'Signature'],
  ['contactEmail', 'E-mail public (CGU, contact, pied de page)'],
  ['contactPhone', 'Téléphone / WhatsApp public'],
  ['channelUrl', 'Chaîne WhatsApp (lien d’invitation)'],
  ['publisher', 'Éditeur'],
  ['address', 'Adresse'],
  ['supportHours', 'Horaires de réponse'],
];

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [providers, setProviders] = useState({});
  const [notice, setNotice] = useState({ type: '', message: '' });
  const [busy, setBusy] = useState(false);
  const site = useSite();
  const [books, setBooks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [spotBusy, setSpotBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.admin
      .books()
      .then((data) => setBooks(data.books || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.admin
      .settings()
      .then((data) => {
        setSettings(data.settings);
        setProviders(data.providers);
      })
      .catch((err) => setNotice({ type: 'error', message: err.message }));
  }, []);

  const spotlightBook = books.find((b) => b.slug === settings?.spotlightBook);

  useEffect(() => {
    if (!spotlightBook) {
      setChapters([]);
      return;
    }
    api.admin
      .chapters(spotlightBook.id)
      .then((data) => setChapters(data.chapters || []))
      .catch(() => setChapters([]));
  }, [spotlightBook?.id]);

  if (!settings) return <p className="muted">Chargement…</p>;

  /* Mise en avant : seuls ces trois champs partent, les autres réglages ne
     bougent pas. */
  const saveSpotlight = async (event) => {
    event.preventDefault();
    setSpotBusy(true);
    try {
      await api.admin.saveSettings({
        spotlightBook: settings.spotlightBook || '',
        spotlightChapter: settings.spotlightChapter || '',
        spotlightUntil: settings.spotlightUntil || '',
      });
      await site.refreshSite?.();
      setNotice({ type: 'ok', message: 'Mise en avant enregistrée : elle est visible en haut de l’accueil.' });
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setSpotBusy(false);
    }
  };

  const announcement = () => {
    const chapter = chapters.find((c) => String(c.number) === String(settings.spotlightChapter));
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/roman/${settings.spotlightBook}`;
    return [
      `Nouveau chapitre : « ${chapter?.title || 'à découvrir'} » — ${spotlightBook?.title || ''} (chapitre ${settings.spotlightChapter}).`,
      url,
      settings.channelUrl ? `Les nouveautés sortent d’abord sur la chaîne WhatsApp : ${settings.channelUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const copyAnnouncement = async () => {
    try {
      await navigator.clipboard.writeText(announcement());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setNotice({ type: 'error', message: 'Copie impossible depuis ce navigateur.' });
    }
  };

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

      <form className="panel" style={{ marginTop: 16 }} onSubmit={saveSpotlight}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Sortie du jour — accueil</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Le chapitre choisi s’affiche tout en haut de l’accueil, avec la couverture du roman. Laissez vide pour
          retirer l’encart. La date limite est facultative : l’encart disparaît tout seul après.
        </p>
        <div className="split">
          <div className="field">
            <label>Roman</label>
            <select
              value={settings.spotlightBook || ''}
              onChange={(e) => setSettings({ ...settings, spotlightBook: e.target.value, spotlightChapter: '' })}
            >
              <option value="">— Aucune mise en avant —</option>
              {books.map((book) => (
                <option key={book.id} value={book.slug}>
                  {book.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Chapitre</label>
            <select
              value={settings.spotlightChapter || ''}
              onChange={(e) => setSettings({ ...settings, spotlightChapter: e.target.value })}
              disabled={!spotlightBook}
            >
              <option value="">— Choisir —</option>
              {chapters.map((chapter) => (
                <option key={chapter.number} value={chapter.number}>
                  {chapter.number}. {chapter.title}
                  {chapter.isFree ? ' (offert)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Visible jusqu’au (facultatif)</label>
            <input
              type="date"
              value={settings.spotlightUntil || ''}
              onChange={(e) => setSettings({ ...settings, spotlightUntil: e.target.value })}
            />
          </div>
        </div>
        {settings.spotlightBook && (
          <div className="field">
            <label>Annonce prête à coller dans la chaîne WhatsApp</label>
            <textarea readOnly rows={4} value={announcement()} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="submit" className="btn btn-gold btn-sm" disabled={spotBusy}>
            {spotBusy ? 'Enregistrement…' : 'Enregistrer la mise en avant'}
          </button>
          {settings.spotlightBook && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyAnnouncement}>
              {copied ? 'Annonce copiée' : 'Copier l’annonce'}
            </button>
          )}
          {(settings.spotlightBook || settings.spotlightChapter) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSettings({ ...settings, spotlightBook: '', spotlightChapter: '', spotlightUntil: '' })}
            >
              Retirer l’encart
            </button>
          )}
        </div>
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
