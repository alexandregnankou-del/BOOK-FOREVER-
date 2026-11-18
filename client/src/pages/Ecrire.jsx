import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useSession } from '../session.jsx';

export default function Ecrire() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [author, setAuthor] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [open, setOpen] = useState(null);
  const [chapter, setChapter] = useState({ number: 1, title: '', text: '' });
  const [form, setForm] = useState({ title: '', tagline: '', synopsis: '' });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .authorStatus()
      .then((data) => {
        setAuthor(data);
        if (data.canWrite) return api.drafts().then((res) => setDrafts(res.books));
        return null;
      })
      .catch(() => {});
  }, [user]);

  const createDraft = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await api.createDraft(form);
      setForm({ title: '', tagline: '', synopsis: '' });
      setDrafts((list) => [{ slug: res.slug, title: form.title, chapters: 0, words: 0, status: 'draft' }, ...list]);
      setNotice('Roman créé. Ajoutez votre premier chapitre.');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openDraft = async (slug) => {
    try {
      const data = await api.draft(slug);
      setOpen(data);
      const next = (data.chapters.at(-1)?.number || 0) + 1;
      setChapter({ number: next, title: '', text: '' });
    } catch (err) {
      setNotice(err.message);
    }
  };

  const saveChapter = async (event) => {
    event.preventDefault();
    if (!open) return;
    setBusy(true);
    try {
      const res = await api.saveChapter(open.book.slug, chapter);
      setNotice(`Chapitre enregistré (${res.words} mots).`);
      const refreshed = await api.draft(open.book.slug);
      setOpen(refreshed);
      setChapter({ number: (refreshed.chapters.at(-1)?.number || 0) + 1, title: '', text: '' });
      setDrafts((list) =>
        list.map((item) =>
          item.slug === open.book.slug ? { ...item, chapters: refreshed.chapters.length } : item,
        ),
      );
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="page">
        <div className="wrap">
          <p className="panel">
            L’atelier est réservé aux auteurs connectés. <Link to="/connexion">Se connecter</Link>
          </p>
        </div>
      </div>
    );
  }

  if (author && !author.canWrite) {
    return (
      <div className="page">
        <div className="wrap">
          <div className="panel">
            <h2>Atelier d’écriture</h2>
            <p>
              {author.status === 'pending'
                ? 'Votre candidature est en cours d’examen. Nous vous répondons par e-mail.'
                : 'L’atelier s’ouvre une fois votre statut d’auteur validé.'}
            </p>
            <p className="hint">
              Statut : <strong>{author.status || 'aucune demande'}</strong> —{' '}
              <Link to="/compte">gérer mon statut d’auteur</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="wrap">
        <div className="auteurs-hero">
          <span className="eyebrow">Atelier d’écriture</span>
          <h1>Vos romans</h1>
          <p className="muted">
            Écrivez chapitre par chapitre. Vos textes restent en brouillon tant que la maison ne les a pas
            publiés — personne ne les lit avant.
          </p>
        </div>

        {notice && <p className="ok" style={{ marginBottom: 16 }}>{notice}</p>}

        <div className="about-grid">
          <div className="panel">
            <h2>Nouveau roman</h2>
            <form className="form" onSubmit={createDraft}>
              <label>
                <span>Titre</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  maxLength={120}
                />
              </label>
              <label>
                <span>Accroche</span>
                <input
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  maxLength={180}
                />
              </label>
              <label>
                <span>Résumé</span>
                <textarea
                  rows={4}
                  value={form.synopsis}
                  onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
                  maxLength={3000}
                />
              </label>
              <button className="btn btn-gold" disabled={busy}>
                Créer
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>Mes brouillons</h2>
            {drafts.length === 0 ? (
              <p className="hint">Aucun roman pour l’instant.</p>
            ) : (
              <ul className="auteurs-list">
                {drafts.map((item) => (
                  <li key={item.slug}>
                    <button className="link-button" onClick={() => openDraft(item.slug)}>
                      {item.title}
                    </button>{' '}
                    <span className="hint">
                      {item.chapters} chapitre(s) · {item.words} mots · {item.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {open && (
          <div className="panel" style={{ marginTop: 22 }}>
            <h2>{open.book.title}</h2>
            <p className="hint">
              {open.chapters.length} chapitre(s) enregistré(s). Les chapitres enregistrés ici restent privés.
            </p>
            <form className="form" onSubmit={saveChapter}>
              <div className="form-row">
                <label>
                  <span>Numéro</span>
                  <input
                    type="number"
                    min={1}
                    value={chapter.number}
                    onChange={(e) => setChapter({ ...chapter, number: Number(e.target.value) })}
                  />
                </label>
                <label>
                  <span>Titre du chapitre</span>
                  <input
                    value={chapter.title}
                    onChange={(e) => setChapter({ ...chapter, title: e.target.value })}
                    maxLength={160}
                  />
                </label>
              </div>
              <label>
                <span>Texte</span>
                <textarea
                  rows={14}
                  value={chapter.text}
                  onChange={(e) => setChapter({ ...chapter, text: e.target.value })}
                  placeholder="Écrivez ici. Une ligne vide sépare deux paragraphes."
                />
              </label>
              <button className="btn btn-gold" disabled={busy}>
                Enregistrer le chapitre
              </button>
            </form>
          </div>
        )}

        <p style={{ marginTop: 20 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/compte')}>
            ← Mon compte
          </button>
        </p>
      </div>
    </div>
  );
}
