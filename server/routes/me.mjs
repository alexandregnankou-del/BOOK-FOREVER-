import express from 'express';
import crypto from 'node:crypto';
import { db, getSettings } from '../db.mjs';
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
    .prepare("SELECT id FROM orders WHERE user_id = ? AND chapter_id = ? AND status = 'paid'")
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
