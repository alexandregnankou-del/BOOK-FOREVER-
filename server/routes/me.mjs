import express from 'express';
import crypto from 'node:crypto';
import {
  db,
  getSettings,
  countWords,
  uniqueSlug,
  offerList,
  availableCredits,
  creditChapterIds,
  spendCredit,
  referralSummary,
  listUserReceipts,
  createClaim,
  listUserClaims,
} from '../db.mjs';
import { requireAuth } from '../auth.mjs';

export const meRoutes = express.Router();
meRoutes.use(requireAuth);

function makeReference(prefix = 'BF') {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
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

function buildInstructions(settings, method, reference, amount, subject = '') {
  const what = subject ? ` (${subject})` : '';
  const tail = 'Revenez ici : tout s’ouvre dès validation (sous 30 min en journée).';
  if (method === 'wave_link') {
    return {
      method,
      label: 'Wave',
      amountXof: amount,
      reference,
      subject,
      url: settings.waveLink,
      steps: [
        'Ouvrez la page Wave ADISEN HOUSE avec le bouton ci-dessous.',
        `Envoyez ${amount} FCFA${what} en indiquant la référence ${reference}.`,
        tail,
      ],
    };
  }
  return {
    method,
    label: 'Orange Money',
    amountXof: amount,
    reference,
    number: settings.orangeNumber,
    subject,
    steps: [
      `Composez #144# puis choisissez « Transfert d’argent » vers le ${settings.orangeNumber}.`,
      `Envoyez ${amount} FCFA${what} en indiquant la référence ${reference}.`,
      tail,
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

/* ---------- v16 : abonnement mensuel · v22 : pass 7 jours ---------- */

function planOf(plan) {
  const offers = offerList();
  if (plan === 'week') return { plan: 'week', label: 'Pass 7 jours', priceXof: offers.pass.priceXof, days: offers.pass.days };
  return { plan: 'monthly', label: 'Abonnement mensuel', priceXof: offers.monthly.priceXof, days: offers.monthly.days };
}

meRoutes.get('/offers', (req, res) => {
  res.json({
    ...offerList(),
    credits: availableCredits(req.user.id),
  });
});

meRoutes.get('/subscription', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 10')
    .all(req.user.id);
  const today = new Date().toISOString().slice(0, 10);
  const active = rows.find((row) => row.status === 'active'
    && (!row.period_end || String(row.period_end).slice(0, 10) >= today));
  const offers = offerList();
  res.json({
    priceXof: offers.monthly.priceXof,
    days: offers.monthly.days,
    pass: offers.pass,
    monthly: offers.monthly,
    accessDays: offers.accessDays,
    active: Boolean(active),
    plan: active?.plan || '',
    subscription: active || rows[0] || null,
    history: rows,
  });
});

meRoutes.post('/subscription', (req, res) => {
  const method = String(req.body?.method || 'wave_link');
  const reference = String(req.body?.reference || '').slice(0, 120);
  const chosen = planOf(String(req.body?.plan || 'monthly'));
  if (!['wave_link', 'orange_money_direct'].includes(method)) {
    return res.status(400).json({ error: 'Moyen de paiement inconnu.' });
  }
  const pending = db
    .prepare("SELECT id FROM subscriptions WHERE user_id = ? AND status = 'pending'")
    .get(req.user.id);
  if (pending) {
    return res.status(409).json({ error: 'Une demande d’abonnement est déjà en attente de validation.' });
  }
  db.prepare('INSERT INTO subscriptions (user_id, method, reference, amount_xof, plan, days) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, method, reference, chosen.priceXof, chosen.plan, chosen.days);
  res.status(201).json({
    ok: true,
    plan: chosen.plan,
    amountXof: chosen.priceXof,
    days: chosen.days,
    instructions: buildInstructions(getSettings(), method, reference, chosen.priceXof, chosen.label),
    message: `${chosen.label} enregistré. Il s’active dès validation du paiement.`,
  });
});

/* ---------- v22 : pack de crédits ---------- */

meRoutes.get('/credits', (req, res) => {
  const orders = db
    .prepare('SELECT id, reference, method, amount_xof, credits, source, note, status, created_at, validated_at\n            FROM credit_orders WHERE user_id = ? ORDER BY id DESC LIMIT 30')
    .all(req.user.id);
  const uses = db
    .prepare(`SELECT cu.created_at, cu.expires_at, b.title AS book_title, c.number, c.title AS chapter_title
              FROM credit_uses cu JOIN books b ON b.id = cu.book_id JOIN chapters c ON c.id = cu.chapter_id
              WHERE cu.user_id = ? ORDER BY cu.id DESC LIMIT 30`)
    .all(req.user.id);
  res.json({
    balance: availableCredits(req.user.id),
    pack: offerList().pack,
    orders,
    uses,
    pendingOrder: orders.find((o) => o.status === 'pending') || null,
  });
});

meRoutes.post('/credits', (req, res) => {
  const method = String(req.body?.method || 'wave_link');
  if (!['wave_link', 'orange_money_direct'].includes(method)) {
    return res.status(400).json({ error: 'Moyen de paiement inconnu.' });
  }
  const pack = offerList().pack;
  const pending = db
    .prepare("SELECT * FROM credit_orders WHERE user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1")
    .get(req.user.id);
  if (pending) {
    return res.json({
      reused: true,
      order: {
        reference: pending.reference,
        amountXof: pending.amount_xof,
        credits: pending.credits,
        method: pending.method,
        status: pending.status,
      },
      instructions: buildInstructions(getSettings(), pending.method, pending.reference, pending.amount_xof, `Pack ${pending.credits} chapitres`),
    });
  }
  const reference = makeReference('BF-PACK');
  db.prepare(`INSERT INTO credit_orders (user_id, reference, method, amount_xof, credits, source, status)
              VALUES (?, ?, ?, ?, ?, 'pack', 'pending')`)
    .run(req.user.id, reference, method, pack.priceXof, pack.credits);
  res.status(201).json({
    order: { reference, amountXof: pack.priceXof, credits: pack.credits, method, status: 'pending' },
    instructions: buildInstructions(getSettings(), method, reference, pack.priceXof, `Pack ${pack.credits} chapitres`),
  });
});

/** Ouvre un chapitre avec un crédit du pack, sans nouveau paiement. */
meRoutes.post('/credits/use', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE slug = ?').get(String(req.body?.bookSlug || ''));
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  const chapter = db
    .prepare("SELECT * FROM chapters WHERE book_id = ? AND number = ? AND status = 'published'")
    .get(book.id, Number(req.body?.chapterNumber));
  if (!chapter) return res.status(404).json({ error: 'Chapitre introuvable.' });
  if (chapter.is_free) return res.status(400).json({ error: 'Ce chapitre est déjà offert.' });

  const already = db
    .prepare(`SELECT id FROM orders WHERE user_id = ? AND chapter_id = ? AND status = 'paid'
              AND (expires_at IS NULL OR date(expires_at) >= date('now'))`)
    .get(req.user.id, chapter.id);
  if (already || creditChapterIds(req.user.id, book.id).has(chapter.id)) {
    return res.status(409).json({ error: 'Ce chapitre est déjà débloqué sur votre compte.' });
  }

  const settings = getSettings();
  const days = Number(settings.accessDays) || 30;
  const used = spendCredit(req.user.id, book.id, chapter.id, days);
  if (!used) {
    return res.status(409).json({
      error: 'Aucun crédit disponible. Le pack s’active après vérification de votre paiement.',
      code: 'no_credit',
    });
  }
  res.json({ ok: true, unlocked: true, balance: availableCredits(req.user.id), accessDays: days });
});

/* ---------- v22 : parrainage ---------- */

meRoutes.get('/referral', (req, res) => {
  res.json(referralSummary(req.user.id));
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

/* -------------------------------------------------------------------------- */
/*                     Phase 6 : Reçus et Réclamations                        */
/* -------------------------------------------------------------------------- */

meRoutes.get('/receipts', (req, res) => {
  const status = String(req.query.status || '');
  const search = String(req.query.search || '');
  const receipts = listUserReceipts(req.user.id, status, search);
  
  // Met à jour dynamiquement le statut si la date d'expiration est dépassée
  const today = new Date().toISOString().slice(0, 10);
  const mapped = receipts.map((r) => {
    const isExpired = r.status === 'confirmed' && r.expires_at && r.expires_at < today;
    return {
      id: r.id,
      receiptNumber: r.receipt_number,
      orderId: r.order_id,
      reference: r.reference,
      bookTitle: r.book_title,
      bookSlug: r.book_slug,
      chapterNumber: r.chapter_number,
      chapterTitle: r.chapter_title,
      amountXof: r.amount_xof,
      currency: r.currency,
      paymentMethod: r.payment_method,
      status: isExpired ? 'expired' : r.status,
      accessType: r.access_type,
      confirmedAt: r.confirmed_at,
      accessStartsAt: r.access_starts_at,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    };
  });

  res.json({ receipts: mapped });
});

meRoutes.get('/receipts/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM receipts WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: 'Reçu introuvable.' });
  const today = new Date().toISOString().slice(0, 10);
  const isExpired = row.status === 'confirmed' && row.expires_at && row.expires_at < today;
  
  res.json({
    receipt: {
      id: row.id,
      receiptNumber: row.receipt_number,
      orderId: row.order_id,
      reference: row.reference,
      bookTitle: row.book_title,
      bookSlug: row.book_slug,
      chapterNumber: row.chapter_number,
      chapterTitle: row.chapter_title,
      amountXof: row.amount_xof,
      currency: row.currency,
      paymentMethod: row.payment_method,
      status: isExpired ? 'expired' : row.status,
      accessType: row.access_type,
      confirmedAt: row.confirmed_at,
      accessStartsAt: row.access_starts_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      vendor: {
        name: getSettings().publisher || 'ADISEN — section Littérature',
        address: getSettings().address || 'Abidjan, Côte d’Ivoire',
        email: getSettings().contactEmail,
        phone: getSettings().contactPhone,
      },
    },
  });
});

meRoutes.get('/claims', (req, res) => {
  const claims = listUserClaims(req.user.id);
  res.json({
    claims: claims.map((c) => ({
      id: c.id,
      claimNumber: c.claim_number,
      category: c.category,
      orderReference: c.order_reference,
      subject: c.subject,
      message: c.message,
      status: c.status,
      adminReply: c.admin_reply,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      resolvedAt: c.resolved_at,
    })),
  });
});

meRoutes.post('/claims', (req, res) => {
  const category = String(req.body?.category || '').trim();
  const message = String(req.body?.message || '').trim();
  const orderReference = String(req.body?.orderReference || '').trim();
  const subject = String(req.body?.subject || '').trim();

  if (!category) return res.status(400).json({ error: 'La catégorie de réclamation est requise.' });
  if (!message || message.length < 10) {
    return res.status(400).json({ error: 'Veuillez décrire votre problème (minimum 10 caractères).' });
  }

  const claim = createClaim({
    userId: req.user.id,
    category,
    orderReference,
    subject,
    message,
  });

  res.status(201).json({
    message: `Réclamation enregistrée sous le dossier ${claim.claim_number}. Notre service client vous répondra rapidement.`,
    claim: {
      id: claim.id,
      claimNumber: claim.claim_number,
      category: claim.category,
      orderReference: claim.order_reference,
      subject: claim.subject,
      message: claim.message,
      status: claim.status,
      createdAt: claim.created_at,
    },
  });
});

