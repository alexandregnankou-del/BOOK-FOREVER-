import express from 'express';
import crypto from 'node:crypto';
import { db, getSettings, countWords, uniqueSlug } from '../db.mjs';
import { requireAuth } from '../auth.mjs';

export const meRoutes = express.Router();
meRoutes.use(requireAuth);

function makeReference() {
  const year = new Date().getFullYear();
  return `BF-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

meRoutes.get('/purchases', (req, res) => {
  const rows = db
    .prepare(`
      SELECT o.*, b.slug AS book_slug, b.title AS book_title, b.cover AS book_cover,
             c.number AS chapter_number, c.title AS chapter_title
      FROM orders o
      JOIN books b ON b.id = o.book_id
      JOIN chapters c ON c.id = o.chapter_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, o.id DESC`)
    .all(req.user.id);
  res.json({
    purchases: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      amountXof: r.amount_xof,
      method: r.method,
      status: r.status,
      note: r.note,
      createdAt: r.created_at,
      validatedAt: r.validated_at,
      book: { slug: r.book_slug, title: r.book_title, cover: r.book_cover },
      chapter: { number: r.chapter_number, title: r.chapter_title },
    })),
  });
});

meRoutes.post('/purchases', (req, res) => {
  const settings = getSettings();
  const slug = String(req.body?.bookSlug || '');
  const number = Number(req.body?.chapterNumber);
  const method = String(req.body?.method || '');

  const allowed = new Set(['wave_link', 'orange_money_direct']);
  if (!allowed.has(method)) {
    return res.status(400).json({ error: 'Moyen de paiement non pris en charge pour un déblocage manuel.' });
  }

  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(slug);
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  const chapter = db
    .prepare("SELECT * FROM chapters WHERE book_id = ? AND number = ? AND status = 'published'")
    .get(book.id, number);
  if (!chapter) return res.status(404).json({ error: 'Chapitre introuvable.' });
  if (chapter.is_free) return res.status(400).json({ error: 'Ce chapitre est déjà offert.' });

  const paid = db
    .prepare(`SELECT id FROM orders WHERE user_id = ? AND chapter_id = ? AND status = 'paid'
              AND (expires_at IS NULL OR date(expires_at) >= date('now'))`)
    .get(req.user.id, chapter.id);
  if (paid) return res.status(409).json({ error: 'Ce chapitre est déjà débloqué sur votre compte.' });

  const pending = db
    .prepare("SELECT * FROM orders WHERE user_id = ? AND chapter_id = ? AND status = 'pending'")
    .get(req.user.id, chapter.id);
  if (pending) {
    return res.json({
      order: {
        reference: pending.reference,
        amountXof: pending.amount_xof,
        method: pending.method,
        status: pending.status,
        createdAt: pending.created_at,
      },
      reused: true,
      instructions: buildInstructions(settings, pending.method, pending.reference, pending.amount_xof),
    });
  }

  const reference = makeReference();
  db.prepare(`
    INSERT INTO orders (reference, user_id, book_id, chapter_id, amount_xof, method, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')`)
    .run(reference, req.user.id, book.id, chapter.id, book.price_xof, method);

  res.status(201).json({
    order: { reference, amountXof: book.price_xof, method, status: 'pending' },
    instructions: buildInstructions(settings, method, reference, book.price_xof),
  });
});

function buildInstructions(settings, method, reference, amount) {
  if (method === 'wave_link') {
    return {
      method,
      label: 'Wave',
      amountXof: amount,
      reference,
      url: settings.waveLink,
      steps: [
        'Ouvrez la page Wave ADISEN HOUSE avec le bouton ci-dessous.',
        `Envoyez ${amount} FCFA en indiquant la référence ${reference}.`,
        'Revenez ici : votre chapitre s’ouvre dès validation (sous 30 min en journée).',
      ],
    };
  }
  return {
    method,
    label: 'Orange Money',
    amountXof: amount,
    reference,
    number: settings.orangeNumber,
    steps: [
      `Composez #144# puis choisissez « Transfert d’argent » vers le ${settings.orangeNumber}.`,
      `Envoyez ${amount} FCFA en indiquant la référence ${reference}.`,
      'Revenez ici : votre chapitre s’ouvre dès validation (sous 30 min en journée).',
    ],
  };
}

meRoutes.get('/progress', (req, res) => {
  const rows = db
    .prepare(`
      SELECT p.*, b.slug AS book_slug, b.title AS book_title, b.cover AS book_cover,
             c.number AS chapter_number, c.title AS chapter_title
      FROM progress p
      JOIN books b ON b.id = p.book_id
      JOIN chapters c ON c.id = p.chapter_id
      WHERE p.user_id = ?
      ORDER BY p.updated_at DESC`)
    .all(req.user.id);
  res.json({
    reading: rows.map((r) => ({
      book: { slug: r.book_slug, title: r.book_title, cover: r.book_cover },
      chapter: { number: r.chapter_number, title: r.chapter_title },
      position: r.position,
      updatedAt: r.updated_at,
    })),
  });
});

meRoutes.post('/progress', (req, res) => {
  const book = db.prepare('SELECT id FROM books WHERE slug = ?').get(String(req.body?.bookSlug || ''));
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  const chapter = db
    .prepare('SELECT id FROM chapters WHERE book_id = ? AND number = ?')
    .get(book.id, Number(req.body?.chapterNumber));
  if (!chapter) return res.status(404).json({ error: 'Chapitre introuvable.' });
  const position = Math.max(0, Math.min(1, Number(req.body?.position) || 0));
  db.prepare(`
    INSERT INTO progress (user_id, book_id, chapter_id, position, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, book_id) DO UPDATE SET
      chapter_id = excluded.chapter_id,
      position = excluded.position,
      updated_at = CURRENT_TIMESTAMP`)
    .run(req.user.id, book.id, chapter.id, position);
  res.json({ ok: true });
});

/* ---------- Favoris (v7) ---------- */
meRoutes.get('/favorites', (req, res) => {
  const rows = db
    .prepare(`
      SELECT f.created_at, b.slug, b.title, b.author, b.cover, b.tagline, b.category_name
      FROM favorites f JOIN books b ON b.id = f.book_id
      WHERE f.user_id = ? AND b.status = 'published'
      ORDER BY f.created_at DESC`)
    .all(req.user.id);
  res.json({
    favorites: rows.map((r) => ({
      addedAt: r.created_at,
      book: {
        slug: r.slug,
        title: r.title,
        author: r.author,
        cover: r.cover,
        tagline: r.tagline,
        category: r.category_name,
      },
    })),
    slugs: rows.map((r) => r.slug),
  });
});

meRoutes.post('/favorites', (req, res) => {
  const book = db
    .prepare("SELECT id, slug FROM books WHERE slug = ? AND status = 'published'")
    .get(String(req.body?.bookSlug || ''));
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  db.prepare('INSERT OR IGNORE INTO favorites (user_id, book_id) VALUES (?, ?)').run(req.user.id, book.id);
  res.status(201).json({ ok: true, favorite: true, slug: book.slug });
});

meRoutes.delete('/favorites/:slug', (req, res) => {
  const book = db.prepare('SELECT id FROM books WHERE slug = ?').get(String(req.params.slug || ''));
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND book_id = ?').run(req.user.id, book.id);
  res.json({ ok: true, favorite: false });
});

/* Vue d'ensemble pour l'accueil : reprise de lecture + favoris. */
meRoutes.get('/overview', (req, res) => {
  const last = db
    .prepare(`
      SELECT p.position, p.updated_at, b.slug AS book_slug, b.title AS book_title, b.cover AS book_cover,
             c.number AS chapter_number, c.title AS chapter_title
      FROM progress p
      JOIN books b ON b.id = p.book_id
      JOIN chapters c ON c.id = p.chapter_id
      WHERE p.user_id = ? AND b.status = 'published'
      ORDER BY p.updated_at DESC LIMIT 1`)
    .get(req.user.id);
  const favorites = db
    .prepare('SELECT COUNT(*) AS n FROM favorites f JOIN books b ON b.id = f.book_id WHERE f.user_id = ?')
    .get(req.user.id);
  const purchases = db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND status = 'paid'")
    .get(req.user.id);
  res.json({
    lastRead: last
      ? {
          book: { slug: last.book_slug, title: last.book_title, cover: last.book_cover },
          chapter: { number: last.chapter_number, title: last.chapter_title },
          position: last.position,
          updatedAt: last.updated_at,
        }
      : null,
    favoritesCount: favorites.n || 0,
    purchasedChapters: purchases.n || 0,
  });
});

/* ---------- v16 : abonnement mensuel ---------- */

const SUB_PRICE = 2000;
const SUB_DAYS = 30;

meRoutes.get('/subscription', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 10')
    .all(req.user.id);
  const active = rows.find((row) => row.status === 'active'
    && (!row.period_end || String(row.period_end).slice(0, 10) >= new Date().toISOString().slice(0, 10)));
  res.json({
    priceXof: SUB_PRICE,
    days: SUB_DAYS,
    active: Boolean(active),
    subscription: active || rows[0] || null,
    history: rows,
  });
});

meRoutes.post('/subscription', (req, res) => {
  const method = String(req.body?.method || 'wave_link');
  const reference = String(req.body?.reference || '').slice(0, 120);
  if (!['wave_link', 'orange_money_direct'].includes(method)) {
    return res.status(400).json({ error: 'Moyen de paiement inconnu.' });
  }
  const pending = db
    .prepare("SELECT id FROM subscriptions WHERE user_id = ? AND status = 'pending'")
    .get(req.user.id);
  if (pending) {
    return res.status(409).json({ error: 'Une demande d’abonnement est déjà en attente de validation.' });
  }
  db.prepare('INSERT INTO subscriptions (user_id, method, reference, amount_xof) VALUES (?, ?, ?, ?)')
    .run(req.user.id, method, reference, SUB_PRICE);
  res.status(201).json({
    ok: true,
    message: 'Demande enregistrée. Votre abonnement s’active dès validation du paiement.',
  });
});

/* ---------- v16 : statut d'auteur ---------- */

meRoutes.get('/author', (req, res) => {
  const user = db
    .prepare('SELECT pen_name, bio, author_status FROM users WHERE id = ?')
    .get(req.user.id);
  res.json({
    status: user?.author_status || '',
    penName: user?.pen_name || '',
    bio: user?.bio || '',
    canWrite: user?.author_status === 'approved',
  });
});

meRoutes.post('/author', (req, res) => {
  const penName = String(req.body?.penName || '').trim().slice(0, 80);
  const bio = String(req.body?.bio || '').trim().slice(0, 1200);
  if (penName.length < 2) return res.status(400).json({ error: 'Indiquez votre nom de plume.' });
  if (bio.length < 40) {
    return res.status(400).json({ error: 'Présentez votre projet en quelques lignes (40 caractères minimum).' });
  }
  if (req.body?.declaration !== true) {
    return res.status(400).json({ error: 'Vous devez certifier que les textes que vous publierez sont les vôtres.' });
  }
  db.prepare("UPDATE users SET pen_name = ?, bio = ?, author_status = 'pending', author_requested_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(penName, bio, req.user.id);
  res.json({ ok: true, message: 'Demande envoyée. Nous revenons vers vous par e-mail.' });
});

/* ---------- v16 : atelier d'écriture ---------- */

function requireAuthor(req, res) {
  const user = db.prepare('SELECT author_status, pen_name, name FROM users WHERE id = ?').get(req.user.id);
  if (!user || user.author_status !== 'approved') {
    res.status(403).json({ error: 'Atelier réservé aux auteurs approuvés.' });
    return null;
  }
  return user;
}

meRoutes.get('/drafts', (req, res) => {
  const author = requireAuthor(req, res);
  if (!author) return;
  const books = db
    .prepare(`SELECT b.id, b.slug, b.title, b.tagline, b.status, b.updated_at,
                     (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) AS chapters,
                     (SELECT COALESCE(SUM(c.words),0) FROM chapters c WHERE c.book_id = b.id) AS words
              FROM books b WHERE b.owner_id = ? ORDER BY b.updated_at DESC`)
    .all(req.user.id);
  res.json({ books });
});

meRoutes.post('/drafts', (req, res) => {
  const author = requireAuthor(req, res);
  if (!author) return;
  const title = String(req.body?.title || '').trim().slice(0, 120);
  if (title.length < 2) return res.status(400).json({ error: 'Donnez un titre à votre roman.' });
  const drafts = db
    .prepare("SELECT COUNT(*) AS total FROM books WHERE owner_id = ? AND status = 'draft'")
    .get(req.user.id).total;
  if (drafts >= 2) {
    return res.status(409).json({
      error: 'Deux romans en cours maximum. Publiez-en un avant d’en commencer un autre.',
    });
  }
  const tagline = String(req.body?.tagline || '').trim().slice(0, 180);
  const synopsis = String(req.body?.synopsis || '').trim().slice(0, 3000);
  const slug = uniqueSlug(title);
  const info = db
    .prepare(`INSERT INTO books (slug, title, author, tagline, synopsis, cover, status, owner_id, sort_order)
              VALUES (?, ?, ?, ?, ?, '', 'draft', ?, 999)`)
    .run(slug, title, author.pen_name || author.name || 'Auteur', tagline, synopsis, req.user.id);
  res.status(201).json({ ok: true, slug, id: info.lastInsertRowid });
});

meRoutes.put('/drafts/:slug', (req, res) => {
  const author = requireAuthor(req, res);
  if (!author) return;
  const book = db.prepare('SELECT * FROM books WHERE slug = ? AND owner_id = ?').get(req.params.slug, req.user.id);
  if (!book) return res.status(404).json({ error: 'Roman introuvable dans votre atelier.' });
  db.prepare('UPDATE books SET title = COALESCE(?, title), tagline = COALESCE(?, tagline), synopsis = COALESCE(?, synopsis), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(
      req.body?.title != null ? String(req.body.title).slice(0, 120) : null,
      req.body?.tagline != null ? String(req.body.tagline).slice(0, 180) : null,
      req.body?.synopsis != null ? String(req.body.synopsis).slice(0, 3000) : null,
      book.id,
    );
  res.json({ ok: true });
});

meRoutes.get('/drafts/:slug', (req, res) => {
  const author = requireAuthor(req, res);
  if (!author) return;
  const book = db.prepare('SELECT * FROM books WHERE slug = ? AND owner_id = ?').get(req.params.slug, req.user.id);
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  const chapters = db
    .prepare('SELECT number, title, words, status, updated_at FROM chapters WHERE book_id = ? ORDER BY number')
    .all(book.id);
  res.json({
    book: { slug: book.slug, title: book.title, tagline: book.tagline, synopsis: book.synopsis, status: book.status },
    chapters,
  });
});

meRoutes.post('/drafts/:slug/chapters', (req, res) => {
  const author = requireAuthor(req, res);
  if (!author) return;
  const book = db.prepare('SELECT * FROM books WHERE slug = ? AND owner_id = ?').get(req.params.slug, req.user.id);
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  const number = Number(req.body?.number);
  const title = String(req.body?.title || '').trim().slice(0, 160);
  const text = String(req.body?.text || '');
  if (!Number.isInteger(number) || number < 1) return res.status(400).json({ error: 'Numéro de chapitre invalide.' });
  if (text.trim().length < 20) return res.status(400).json({ error: 'Le chapitre est trop court.' });
  const words = countWords(text);
  const existing = db.prepare('SELECT id FROM chapters WHERE book_id = ? AND number = ?').get(book.id, number);
  if (existing) {
    db.prepare('UPDATE chapters SET title = ?, text = ?, words = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(title, text, words, existing.id);
  } else {
    db.prepare("INSERT INTO chapters (book_id, number, title, text, words, is_free, status) VALUES (?, ?, ?, ?, ?, 0, 'draft')")
      .run(book.id, number, title, text, words);
  }
  db.prepare('UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(book.id);
  res.json({ ok: true, words });
});

/* ---------- v17 : audience de l'auteur et conditions du titre ---------- */

meRoutes.get('/audience', (req, res) => {
  const me = db.prepare('SELECT name, pen_name, author_status FROM users WHERE id = ?').get(req.user.id);
  const name = me?.pen_name || me?.name || '';

  const books = db
    .prepare("SELECT id, title, views FROM books WHERE owner_id = ? OR (owner_id IS NULL AND author = ?)")
    .all(req.user.id, name);
  const ids = books.map((book) => book.id);
  const views = books.reduce((total, book) => total + (book.views || 0), 0);
  const hearts = ids.length
    ? db.prepare(`SELECT COUNT(*) AS total FROM book_reactions WHERE book_id IN (${ids.map(() => '?').join(',')})`).get(...ids).total
    : 0;
  const followers = name
    ? db.prepare('SELECT COUNT(*) AS total FROM author_follows WHERE author_name = ?').get(name).total
    : 0;

  const settings = getSettings();
  const confirmed = {
    views: Number(settings.authorMinViews || 1000),
    hearts: Number(settings.authorMinHearts || 100),
    followers: Number(settings.authorMinFollowers || 50),
  };
  const certified = {
    views: Number(settings.authorCertViews || 10000),
    hearts: Number(settings.authorCertHearts || 1000),
    followers: Number(settings.authorCertFollowers || 500),
  };
  const meets = (level) => views >= level.views && hearts >= level.hearts && followers >= level.followers;
  const isConfirmed = meets(confirmed);
  const isCertified = meets(certified);
  const next = isCertified ? certified : confirmed;
  const thresholds = next;

  res.json({
    name,
    status: me?.author_status || '',
    books: books.length,
    views,
    hearts,
    followers,
    thresholds,
    confirmed: isConfirmed,
    certified: isCertified,
    level: isCertified ? 'certifié' : isConfirmed ? 'confirmé' : 'en cours',
    nextLevel: isCertified ? null : isConfirmed ? 'certifié' : 'confirmé',
    progress: {
      views: Math.min(100, Math.round((views / next.views) * 100)),
      hearts: Math.min(100, Math.round((hearts / next.hearts) * 100)),
      followers: Math.min(100, Math.round((followers / next.followers) * 100)),
    },
  });
});
