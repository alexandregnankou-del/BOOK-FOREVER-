import { useCallback, useEffect, useState } from 'react';
import { api, formatXof } from '../api.js';

const emptyBook = {
  title: '',
  author: 'Alexandre Anderson G',
  tagline: '',
  synopsis: '',
  categoryName: 'Roman',
  priceXof: 300,
  freeChapters: 2,
  status: 'draft',
  cover: '',
};

export default function Books() {
  const [books, setBooks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [chapterForm, setChapterForm] = useState(null);
  const [importing, setImporting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', message: '' });

  const loadBooks = useCallback(async () => {
    const { books: list } = await api.admin.books();
    setBooks(list);
    if (selected) {
      const fresh = list.find((b) => b.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [selected]);

  useEffect(() => {
    api.admin.books().then(({ books: list }) => setBooks(list)).catch((err) => setNotice({ type: 'error', message: err.message }));
  }, []);

  const openBook = async (book) => {
    setSelected(book);
    setNotice({ type: '', message: '' });
    const { chapters: list } = await api.admin.chapters(book.id);
    setChapters(list);
  };

  const saveBook = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice({ type: '', message: '' });
    try {
      if (editing.id) {
        const { book } = await api.admin.updateBook(editing.id, editing);
        setBooks((list) => list.map((b) => (b.id === book.id ? book : b)));
        if (selected?.id === book.id) setSelected(book);
        setNotice({ type: 'ok', message: 'Roman mis à jour.' });
      } else {
        const { book } = await api.admin.createBook(editing);
        setBooks((list) => [...list, book]);
        setNotice({ type: 'ok', message: 'Roman créé. Ajoutez maintenant ses chapitres.' });
        setSelected(book);
      }
      setEditing(null);
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const saveChapter = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (chapterForm.id) await api.admin.updateChapter(chapterForm.id, chapterForm);
      else await api.admin.createChapter(selected.id, chapterForm);
      const { chapters: list } = await api.admin.chapters(selected.id);
      setChapters(list);
      setChapterForm(null);
      setNotice({ type: 'ok', message: 'Chapitre enregistré.' });
      loadBooks();
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const editChapter = async (chapter) => {
    const { chapter: full } = await api.admin.chapter(chapter.id);
    setChapterForm({ ...full, isFree: Boolean(full.is_free) });
  };

  const runImport = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await api.admin.import(selected.id, importing);
      const { chapters: list } = await api.admin.chapters(selected.id);
      setChapters(list);
      setImporting(null);
      setNotice({ type: 'ok', message: `${res.imported} chapitre(s) importé(s).` });
      loadBooks();
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const uploadCover = async (file) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const { url } = await api.admin.uploadCover({ dataUrl, name: editing?.title || 'couverture' });
    setEditing((form) => ({ ...form, cover: url }));
  };

  return (
    <>
      <div className="console-head">
        <div>
          <span className="eyebrow">Catalogue</span>
          <h1>Romans &amp; chapitres</h1>
        </div>
        <button type="button" className="btn btn-gold btn-sm" onClick={() => setEditing({ ...emptyBook })}>
          + Nouveau roman
        </button>
      </div>

      {notice.message && <div className={`alert ${notice.type}`}>{notice.message}</div>}

      {editing && (
        <form className="panel" style={{ marginBottom: 20 }} onSubmit={saveBook}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 12 }}>{editing.id ? 'Modifier le roman' : 'Nouveau roman'}</h2>
          <div className="split">
            <div>
              <div className="field">
                <label>Titre</label>
                <input required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="field">
                <label>Auteur — laissez libre pour un partenaire</label>
                <input value={editing.author} onChange={(e) => setEditing({ ...editing, author: e.target.value })} />
              </div>
              <div className="field">
                <label>Accroche</label>
                <input value={editing.tagline} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} />
              </div>
              <div className="field">
                <label>Résumé</label>
                <textarea
                  value={editing.synopsis}
                  onChange={(e) => setEditing({ ...editing, synopsis: e.target.value })}
                  style={{ minHeight: 160 }}
                />
              </div>
            </div>
            <div>
              <div className="field">
                <label>Catégorie</label>
                <input
                  value={editing.categoryName}
                  onChange={(e) => setEditing({ ...editing, categoryName: e.target.value })}
                  placeholder="Drame, Romance, Foi & destin…"
                />
              </div>
              <div className="field">
                <label>Prix du chapitre (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  value={editing.priceXof}
                  onChange={(e) => setEditing({ ...editing, priceXof: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Chapitres offerts</label>
                <input
                  type="number"
                  min="0"
                  value={editing.freeChapters}
                  onChange={(e) => setEditing({ ...editing, freeChapters: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Statut</label>
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="draft">Brouillon</option>
                  <option value="published">Publié</option>
                  <option value="archived">Archivé</option>
                </select>
              </div>
              <div className="field">
                <label>Couverture (chemin ou fichier)</label>
                <input value={editing.cover} onChange={(e) => setEditing({ ...editing, cover: e.target.value })} placeholder="/media/covers/…" />
                <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && uploadCover(e.target.files[0])} />
              </div>
              {editing.cover && (
                <img src={editing.cover} alt="" style={{ width: 90, borderRadius: 8, marginTop: 6 }} />
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>
              Enregistrer
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="split" style={{ alignItems: 'start' }}>
        <div className="panel">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 10 }}>Catalogue ({books.length})</h2>
          {books.map((book) => (
            <div
              className="row-item"
              key={book.id}
              style={{ cursor: 'pointer', background: selected?.id === book.id ? 'rgba(185,139,46,0.07)' : 'transparent' }}
              onClick={() => openBook(book)}
            >
              <img src={book.cover} alt="" />
              <div className="grow">
                <strong>{book.title}</strong>
                <span>
                  {book.author} · {book.chaptersWithText}/{book.chaptersTotal} chapitres · {formatXof(book.priceXof)}
                </span>
              </div>
              <span className={`pill ${book.status === 'published' ? 'free' : 'dark'}`}>
                {book.status === 'published' ? 'En ligne' : book.status === 'draft' ? 'Brouillon' : 'Archivé'}
              </span>
            </div>
          ))}
          {books.length === 0 && <p className="empty">Aucun roman.</p>}
        </div>

        <div className="panel">
          {!selected ? (
            <p className="empty">Sélectionnez un roman à gauche pour gérer ses chapitres.</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.15rem' }}>{selected.title}</h2>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...selected })}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setChapterForm({ title: '', text: '', isFree: false })}
                  >
                    + Chapitre
                  </button>
                  <button
                    type="button"
                    className="btn btn-gold btn-sm"
                    onClick={() => setImporting({ text: '', mode: 'replace' })}
                  >
                    Importer un manuscrit
                  </button>
                </div>
              </div>

              {chapterForm && (
                <form onSubmit={saveChapter} style={{ margin: '16px 0', borderTop: '1px solid #e2d8c8', paddingTop: 14 }}>
                  <div className="field">
                    <label>Titre du chapitre</label>
                    <input
                      required
                      value={chapterForm.title}
                      onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Texte</label>
                    <textarea
                      value={chapterForm.text}
                      onChange={(e) => setChapterForm({ ...chapterForm, text: e.target.value })}
                      style={{ minHeight: 220 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    <label style={{ fontSize: '0.84rem' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(chapterForm.isFree)}
                        onChange={(e) => setChapterForm({ ...chapterForm, isFree: e.target.checked })}
                      />{' '}
                      Chapitre offert
                    </label>
                    <label style={{ fontSize: '0.84rem' }}>
                      Statut{' '}
                      <select
                        value={chapterForm.status || 'published'}
                        onChange={(e) => setChapterForm({ ...chapterForm, status: e.target.value })}
                      >
                        <option value="published">Publié</option>
                        <option value="draft">Brouillon</option>
                      </select>
                    </label>
                    <span className="muted" style={{ fontSize: '0.78rem' }}>
                      {String(chapterForm.text || '').trim().split(/\s+/).filter(Boolean).length} mots
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>
                      Enregistrer le chapitre
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setChapterForm(null)}>
                      Annuler
                    </button>
                  </div>
                </form>
              )}

              {importing && (
                <form onSubmit={runImport} style={{ margin: '16px 0', borderTop: '1px solid #e2d8c8', paddingTop: 14 }}>
                  <p className="muted" style={{ fontSize: '0.84rem' }}>
                    Collez le manuscrit entier. Le découpage se fait sur les lignes « Chapitre 1 », « Chapitre 2 »…
                    (ou « CHAPITRE PREMIER »).
                  </p>
                  <div className="field">
                    <label>Manuscrit</label>
                    <textarea
                      required
                      value={importing.text}
                      onChange={(e) => setImporting({ ...importing, text: e.target.value })}
                      style={{ minHeight: 220 }}
                      placeholder={'Chapitre 1\n\nTexte…\n\nChapitre 2\n\nTexte…'}
                    />
                  </div>
                  <div className="field">
                    <label>Mode</label>
                    <select value={importing.mode} onChange={(e) => setImporting({ ...importing, mode: e.target.value })}>
                      <option value="replace">Remplacer les chapitres existants</option>
                      <option value="append">Ajouter à la suite</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>
                      Importer
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImporting(null)}>
                      Annuler
                    </button>
                  </div>
                </form>
              )}

              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Titre</th>
                      <th>Mots</th>
                      <th>Accès</th>
                      <th>Statut</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {chapters.map((chapter) => (
                      <tr key={chapter.id}>
                        <td>{chapter.number}</td>
                        <td>{chapter.title}</td>
                        <td>{chapter.words || '—'}</td>
                        <td>
                          <span className={`pill ${chapter.isFree ? 'free' : 'dark'}`}>
                            {chapter.isFree ? 'Offert' : 'Payant'}
                          </span>
                        </td>
                        <td>{chapter.status === 'published' ? 'Publié' : 'Brouillon'}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => editChapter(chapter)}>
                            Ouvrir
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ marginLeft: 6 }}
                            onClick={async () => {
                              if (!window.confirm(`Supprimer le chapitre ${chapter.number} ?`)) return;
                              await api.admin.deleteChapter(chapter.id);
                              const { chapters: list } = await api.admin.chapters(selected.id);
                              setChapters(list);
                              loadBooks();
                            }}
                          >
                            Suppr.
                          </button>
                        </td>
                      </tr>
                    ))}
                    {chapters.length === 0 && (
                      <tr>
                        <td colSpan={6} className="empty">
                          Aucun chapitre. Utilisez « Importer un manuscrit ».
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
