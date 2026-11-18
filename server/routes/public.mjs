import express from 'express';
import { hasActiveSubscription, db, getSettings, publicSite } from '../db.mjs';
import { currentUser } from '../auth.mjs';

const APP_VERSION = '1.19.0';

export const publicRoutes = express.Router();

function chapterSummary(row, { includeText = false } = {}) {
  const out = {
    id: row.id,
    number: row.number,
    title: row.title,
    isFree: Boolean(row.is_free),
    words: row.words,
    status: row.status,
  };
  if (includeText) out.text = row.text;
  return out;
}

function bookCard(row) {
  const counts = db
    .prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
             SUM(CASE WHEN is_free = 1 AND status = 'published' THEN 1 ELSE 0 END) AS free,
             SUM(CASE WHEN text <> '' AND status = 'published' THEN 1 ELSE 0 END) AS withText
      FROM chapters WHERE book_id = ?`)
    .get(row.id);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    tagline: row.tagline,
    synopsis: row.synopsis,
    cover: row.cover,
    category: { slug: row.category_slug, name: row.category_name },
    status: row.status,
    priceXof: row.price_xof,
    freeChapters: row.free_chapters,
    downloadAllowed: Boolean(row.download_allowed),
    createdAt: row.created_at,
    chaptersTotal: counts.total || 0,
    chaptersPublished: counts.published || 0,
    chaptersFree: counts.free || 0,
    chaptersWithText: counts.withText || 0,
    hasContent: (counts.withText || 0) > 0,
  };
}

function paidChapterIds(userId, bookId) {
  if (!userId) return new Set();
  const rows = db
    .prepare("SELECT chapter_id FROM orders WHERE user_id = ? AND book_id = ? AND status = 'paid'")
    .all(userId, bookId);
  return new Set(rows.map((r) => r.chapter_id));
}

publicRoutes.get('/health', (req, res) => {
  const checks = { db: true };
  try {
    db.prepare('SELECT 1').get();
  } catch {
    checks.db = false;
  }
  res.status(checks.db ? 200 : 503).json({
    ok: checks.db,
    release: 'v19',
    version: APP_VERSION,
    time: new Date().toISOString(),
    payments: { anyProviderConfigured: Boolean(getSettings().waveLink || getSettings().orangeNumber) },
  });
});

publicRoutes.get('/site', (req, res) => res.json(publicSite()));

function audienceOf(book, userId) {
  const hearts = db.prepare('SELECT COUNT(*) AS total FROM book_reactions WHERE book_id = ?').get(book.id).total;
  const breakdown = db.prepare('SELECT emoji, COUNT(*) AS total FROM book_reactions WHERE book_id = ? GROUP BY emoji ORDER BY total DESC').all(book.id);
  const mine = userId
    ? db.prepare('SELECT emoji FROM book_reactions WHERE book_id = ? AND user_id = ?').get(book.id, userId)
    : null;
  const following = userId
    ? Boolean(db.prepare('SELECT 1 FROM author_follows WHERE user_id = ? AND author_name = ?').get(userId, book.author))
    : false;
  return {
    authorName: book.author,
    views: book.views || 0,
    hearts,
    breakdown,
    myReaction: mine?.emoji || null,
    followers: db.prepare('SELECT COUNT(*) AS total FROM author_follows WHERE author_name = ?').get(book.author).total,
    following,
  };
}

publicRoutes.get('/books', (req, res) => {
  const rows = db
    .prepare("SELECT * FROM books WHERE status = 'published' ORDER BY sort_order, id")
    .all();
  res.json({ books: rows.map((book) => ({ ...bookCard(book), ...audienceOf(book) })) });
});

publicRoutes.get('/books/:slug', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(req.params.slug);
  if (!book || book.status === 'archived') return res.status(404).json({ error: 'Roman introuvable.' });

  const user = currentUser(req);
  const paid = paidChapterIds(user?.id, book.id);
  const isAdmin = user?.role === 'admin';
  const subscribed = hasActiveSubscription(user?.id);
  const chapters = db
    .prepare("SELECT * FROM chapters WHERE book_id = ? AND status = 'published' ORDER BY number")
    .all(book.id)
    .map((ch) => ({
      ...chapterSummary(ch),
      unlocked: Boolean(ch.is_free) || isAdmin || paid.has(ch.id) || subscribed,
    }));

  res.json({ book: bookCard(book), chapters, audience: audienceOf(book, user?.id) });
});

publicRoutes.get('/books/:slug/chapters/:number', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(req.params.slug);
  if (!book || book.status === 'archived') return res.status(404).json({ error: 'Roman introuvable.' });
  const number = Number(req.params.number);
  const chapter = db
    .prepare("SELECT * FROM chapters WHERE book_id = ? AND number = ? AND status = 'published'")
    .get(book.id, number);
  if (!chapter) return res.status(404).json({ error: 'Chapitre introuvable.' });

  const user = currentUser(req);
  const paid = paidChapterIds(user?.id, book.id);
  const settings = getSettings();
  const unlocked = Boolean(chapter.is_free) || user?.role === 'admin' || paid.has(chapter.id)
    || hasActiveSubscription(user?.id);

  const neighbours = db
    .prepare("SELECT number, title FROM chapters WHERE book_id = ? AND status = 'published' ORDER BY number")
    .all(book.id);
  const index = neighbours.findIndex((c) => c.number === number);

  if (!unlocked) {
    return res.status(402).json({
      locked: true,
      reason: 'locked',
      chapter: {
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        isFree: false,
        priceXof: book.price_xof,
        words: chapter.words,
      },
      book: { slug: book.slug, title: book.title, author: book.author, cover: book.cover },
      paywall: {
        title: 'Vous êtes arrivé à la suite de votre histoire !',
        message: `Débloquez ce chapitre pour seulement ${book.price_xof} FCFA.`,
        priceXof: book.price_xof,
        methods: [
          { id: 'wave_link', label: 'Wave', enabled: settings.waveEnabled === '1' },
          { id: 'orange_money_direct', label: 'Orange Money', enabled: settings.orangeEnabled === '1' },
        ],
      },
      navigation: {
        previous: index > 0 ? neighbours[index - 1] : null,
        next: index < neighbours.length - 1 ? neighbours[index + 1] : null,
      },
      chapters: neighbours,
    });
  }

  res.json({
    locked: false,
    chapter: {
      ...chapterSummary(chapter, { includeText: true }),
      priceXof: chapter.is_free ? 0 : book.price_xof,
      access: chapter.is_free ? 'free' : 'purchased',
      downloadable: Boolean(book.download_allowed),
    },
    book: { slug: book.slug, title: book.title, author: book.author, cover: book.cover },
    navigation: {
      previous: index > 0 ? neighbours[index - 1] : null,
      next: index < neighbours.length - 1 ? neighbours[index + 1] : null,
    },
    chapters: neighbours,
  });
});

publicRoutes.post('/contact', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Merci d’indiquer votre nom.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  if (body.length < 10) return res.status(400).json({ error: 'Votre message est trop court.' });
  const info = db
    .prepare('INSERT INTO messages (name, email, subject, body) VALUES (?, ?, ?, ?)')
    .run(name.slice(0, 120), email.slice(0, 160), subject.slice(0, 160), body.slice(0, 5000));
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'Message reçu. Nous répondons sous 24 h ouvrées.' });
});

/* ---------- v17 : audience (vues, cœurs, abonnés) ---------- */

const REACTIONS = ['❤️', '🔥', '😭', '😍', '👏'];

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function bookBySlug(slug) {
  return db.prepare("SELECT id, slug, author, owner_id FROM books WHERE slug = ? AND status = 'published'").get(slug);
}

/* Une vue par personne et par jour : on ne gonfle pas les compteurs. */
publicRoutes.post('/books/:slug/view', (req, res) => {
  const book = bookBySlug(req.params.slug);
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  const chapterNumber = Number(req.body?.chapterNumber) || null;
  const who = req.user ? `u:${req.user.id}` : `ip:${String(req.ip || '').slice(0, 40)}`;
  const key = `view:${book.id}:${chapterNumber || 0}:${who}:${dayKey()}`;
  const seen = db.prepare('SELECT 1 FROM book_views WHERE book_id = ? AND chapter_id IS ? AND user_id IS ? AND substr(created_at,1,10) = ?')
    .get(book.id, chapterNumber, req.user?.id ?? null, dayKey());
  if (seen) return res.json({ ok: true, counted: false });

  let chapterId = null;
  if (chapterNumber) {
    const chapter = db.prepare('SELECT id FROM chapters WHERE book_id = ? AND number = ?').get(book.id, chapterNumber);
    chapterId = chapter ? chapter.id : null;
    if (chapterId) db.prepare('UPDATE chapters SET views = views + 1 WHERE id = ?').run(chapterId);
  }
  db.prepare('UPDATE books SET views = views + 1 WHERE id = ?').run(book.id);
  db.prepare('INSERT INTO book_views (book_id, chapter_id, user_id) VALUES (?, ?, ?)')
    .run(book.id, chapterId, req.user?.id || null);
  res.json({ ok: true, counted: true, views: db.prepare('SELECT views FROM books WHERE id = ?').get(book.id).views });
});

/* Réactions : une par lecteur et par roman, modifiable. */
publicRoutes.post('/books/:slug/react', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Connectez-vous pour réagir.' });
  const book = bookBySlug(req.params.slug);
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  const emoji = String(req.body?.emoji || '❤️');
  if (!REACTIONS.includes(emoji)) return res.status(400).json({ error: 'Réaction inconnue.' });
  db.prepare(`INSERT INTO book_reactions (user_id, book_id, emoji) VALUES (?, ?, ?)
              ON CONFLICT(user_id, book_id) DO UPDATE SET emoji = excluded.emoji`)
    .run(user.id, book.id, emoji);
  res.json({ ok: true, ...reactionSummary(book.id, user.id) });
});

publicRoutes.delete('/books/:slug/react', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Connectez-vous pour réagir.' });
  const book = bookBySlug(req.params.slug);
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  db.prepare('DELETE FROM book_reactions WHERE user_id = ? AND book_id = ?').run(user.id, book.id);
  res.json({ ok: true, ...reactionSummary(book.id, user.id) });
});

function reactionSummary(bookId, userId) {
  const counts = db.prepare('SELECT emoji, COUNT(*) AS total FROM book_reactions WHERE book_id = ? GROUP BY emoji')
    .all(bookId);
  const total = counts.reduce((sum, row) => sum + row.total, 0);
  const mine = userId
    ? db.prepare('SELECT emoji FROM book_reactions WHERE book_id = ? AND user_id = ?').get(bookId, userId)
    : null;
  return { reactions: counts, totalReactions: total, myReaction: mine?.emoji || null };
}

/* Suivre un auteur. */
publicRoutes.post('/authors/:name/follow', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Connectez-vous pour suivre un auteur.' });
  const name = String(req.params.name || '').trim().slice(0, 120);
  if (!name) return res.status(400).json({ error: 'Auteur inconnu.' });
  db.prepare('INSERT OR IGNORE INTO author_follows (user_id, author_name) VALUES (?, ?)').run(user.id, name);
  res.json({ ok: true, followers: followersOf(name), following: true });
});

publicRoutes.delete('/authors/:name/follow', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Connectez-vous pour suivre un auteur.' });
  const name = String(req.params.name || '').trim().slice(0, 120);
  db.prepare('DELETE FROM author_follows WHERE user_id = ? AND author_name = ?').run(user.id, name);
  res.json({ ok: true, followers: followersOf(name), following: false });
});

function followersOf(name) {
  return db.prepare('SELECT COUNT(*) AS total FROM author_follows WHERE author_name = ?').get(name).total;
}
