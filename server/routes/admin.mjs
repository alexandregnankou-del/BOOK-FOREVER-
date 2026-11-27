import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import {
  db,
  getSettings,
  countWords,
  slugify,
  uniqueSlug,
  grantCredits,
  shareStats,
  generateReceiptForOrder,
  listAdminClaims,
  listContestEntries,
  contestStats,
} from '../db.mjs';
import { requireAdmin } from '../auth.mjs';
import config from '../config.mjs';

export const adminRoutes = express.Router();
adminRoutes.use(requireAdmin);

adminRoutes.get('/stats', (req, res) => {
  const revenue = db.prepare("SELECT COALESCE(SUM(amount_xof),0) AS total, COUNT(*) AS sales FROM orders WHERE status = 'paid'").get();
  const last30 = db
    .prepare("SELECT COALESCE(SUM(amount_xof),0) AS total, COUNT(*) AS sales FROM orders WHERE status = 'paid' AND validated_at >= datetime('now','-30 day')")
    .get();
  const subsRevenue = db
    .prepare("SELECT COALESCE(SUM(amount_xof),0) AS total, COUNT(*) AS sales FROM subscriptions WHERE status = 'active'")
    .get();
  const packsRevenue = db
    .prepare("SELECT COALESCE(SUM(amount_xof),0) AS total, COUNT(*) AS sales, COALESCE(SUM(credits),0) AS credits FROM credit_orders WHERE status = 'active'")
    .get();
  const counts = {
    books: db.prepare('SELECT COUNT(*) AS n FROM books').get().n,
    published: db.prepare("SELECT COUNT(*) AS n FROM books WHERE status = 'published'").get().n,
    chapters: db.prepare('SELECT COUNT(*) AS n FROM chapters').get().n,
    chaptersWithText: db.prepare("SELECT COUNT(*) AS n FROM chapters WHERE text <> ''").get().n,
    readers: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'reader'").get().n,
    pendingOrders: db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'").get().n,
    pendingSubs: db.prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'pending'").get().n,
    pendingPacks: db.prepare("SELECT COUNT(*) AS n FROM credit_orders WHERE status = 'pending'").get().n,
    newMessages: db.prepare("SELECT COUNT(*) AS n FROM messages WHERE status = 'new'").get().n,
    /* Audience : cœurs et partages, les deux chiffres que l'éditeur regarde. */
    likes: db.prepare('SELECT COUNT(*) AS n FROM book_reactions').get().n,
    shares: db.prepare('SELECT COUNT(*) AS n FROM shares').get().n,
  };
  const providers = {
    wave: Boolean(getSettings().waveLink),
    orange: Boolean(getSettings().orangeNumber),
    waveApi: Boolean(process.env.WAVE_API_KEY),
    orangeApi: Boolean(process.env.ORANGE_CLIENT_ID),
    email: Boolean(config.resendKey),
  };
  const recent = db
    .prepare(`
      SELECT o.reference, o.amount_xof, o.method, o.status, o.created_at,
             b.title AS book_title, c.number AS chapter_number, u.email
      FROM orders o JOIN books b ON b.id = o.book_id JOIN chapters c ON c.id = o.chapter_id JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC LIMIT 8`)
    .all();
  res.json({
    revenueXof: revenue.total + subsRevenue.total + packsRevenue.total,
    sales: revenue.sales + subsRevenue.sales + packsRevenue.sales,
    last30: { revenueXof: last30.total, sales: last30.sales },
    breakdown: {
      chapters: { revenueXof: revenue.total, sales: revenue.sales },
      subscriptions: { revenueXof: subsRevenue.total, sales: subsRevenue.sales },
      packs: { revenueXof: packsRevenue.total, sales: packsRevenue.sales, credits: packsRevenue.credits },
    },
    counts,
    providers,
    recent,
    /* La console doit savoir si la base survivra à un redémarrage : vendre un
       accès que le prochain redémarrage efface serait malhonnête. */
    storage: { persistent: config.storagePersistent },
    audience: shareStats(),
  });
});

/* -------------------------------- Audience -------------------------------- */

adminRoutes.get('/audience', (req, res) => {
  const books = db
    .prepare(
      `SELECT b.id, b.slug, b.title, b.views,
              (SELECT COUNT(*) FROM book_reactions r WHERE r.book_id = b.id) AS likes,
              (SELECT COUNT(*) FROM shares s WHERE s.book_id = b.id) AS shares,
              (SELECT COUNT(*) FROM author_follows f WHERE f.author_name = b.author) AS followers,
              (SELECT COUNT(*) FROM favorites fa WHERE fa.book_id = b.id) AS favorites
         FROM books b WHERE b.status = 'published' ORDER BY b.views DESC, b.id`,
    )
    .all();
  const byChannel = db
    .prepare('SELECT channel, COUNT(*) AS n FROM shares GROUP BY channel ORDER BY n DESC')
    .all();
  const daily = db
    .prepare(
      `SELECT substr(created_at,1,10) AS day, COUNT(*) AS n FROM shares
        WHERE created_at >= datetime('now','-14 day') GROUP BY day ORDER BY day`,
    )
    .all();
  const totals = books.reduce(
    (acc, b) => ({ views: acc.views + b.views, likes: acc.likes + b.likes, shares: acc.shares + b.shares }),
    { views: 0, likes: 0, shares: 0 },
  );
  res.json({ books, byChannel, daily, totals: { ...totals, ...shareStats() } });
});

/* ---------------------------------- Romans --------------------------------- */

function bookRow(row) {
  const counts = db
    .prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN text <> '' THEN 1 ELSE 0 END) AS withText,
                     SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published
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
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    priceXof: row.price_xof,
    freeChapters: row.free_chapters,
    status: row.status,
    downloadAllowed: Boolean(row.download_allowed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    chaptersTotal: counts.total || 0,
    chaptersPublished: counts.published || 0,
    chaptersWithText: counts.withText || 0,
  };
}

adminRoutes.get('/books', (req, res) => {
  const rows = db.prepare('SELECT * FROM books ORDER BY sort_order, id').all();
  res.json({ books: rows.map(bookRow) });
});

adminRoutes.post('/books', (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (title.length < 2) return res.status(400).json({ error: 'Le titre est requis.' });
  const slug = uniqueSlug(req.body?.slug || title);
  const info = db
    .prepare(`INSERT INTO books (slug, title, author, tagline, synopsis, cover, category_slug, category_name, price_xof, free_chapters, status, download_allowed)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      slug,
      title,
      String(req.body?.author || 'Alexandre Anderson G').trim(),
      String(req.body?.tagline || '').trim(),
      String(req.body?.synopsis || '').trim(),
      String(req.body?.cover || '/media/covers/placeholder.webp').trim(),
      slugify(req.body?.categoryName || 'Roman'),
      String(req.body?.categoryName || 'Roman').trim(),
      Number(req.body?.priceXof) || getSettings().priceXof,
      Number(req.body?.freeChapters) || 2,
      ['draft', 'published', 'archived'].includes(req.body?.status) ? req.body.status : 'draft',
      req.body?.downloadAllowed ? 1 : 0,
    );
  res.status(201).json({ book: bookRow(db.prepare('SELECT * FROM books WHERE id = ?').get(info.lastInsertRowid)) });
});

adminRoutes.patch('/books/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(Number(req.params.id));
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  const fields = {
    title: req.body?.title ?? book.title,
    author: req.body?.author ?? book.author,
    tagline: req.body?.tagline ?? book.tagline,
    synopsis: req.body?.synopsis ?? book.synopsis,
    cover: req.body?.cover ?? book.cover,
    category_slug: req.body?.categoryName ? slugify(req.body.categoryName) : book.category_slug,
    category_name: req.body?.categoryName ?? book.category_name,
    price_xof: req.body?.priceXof != null ? Number(req.body.priceXof) : book.price_xof,
    free_chapters: req.body?.freeChapters != null ? Number(req.body.freeChapters) : book.free_chapters,
    status: req.body?.status ?? book.status,
    download_allowed: req.body?.downloadAllowed != null ? (req.body.downloadAllowed ? 1 : 0) : book.download_allowed,
  };
  db.prepare(`UPDATE books SET title=?, author=?, tagline=?, synopsis=?, cover=?, category_slug=?, category_name=?,
              price_xof=?, free_chapters=?, status=?, download_allowed=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(fields.title, fields.author, fields.tagline, fields.synopsis, fields.cover, fields.category_slug,
      fields.category_name, fields.price_xof, fields.free_chapters, fields.status, fields.download_allowed, book.id);
  res.json({ book: bookRow(db.prepare('SELECT * FROM books WHERE id = ?').get(book.id)) });
});

adminRoutes.delete('/books/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(Number(req.params.id));
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  db.prepare("UPDATE books SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(book.id);
  res.json({ ok: true, archived: true });
});

/* -------------------------------- Chapitres -------------------------------- */

adminRoutes.get('/books/:id/chapters', (req, res) => {
  const rows = db
    .prepare('SELECT id, book_id, number, title, is_free, words, status, length(text) AS chars, updated_at FROM chapters WHERE book_id = ? ORDER BY number')
    .all(Number(req.params.id));
  res.json({ chapters: rows.map((r) => ({ ...r, isFree: Boolean(r.is_free), hasText: r.chars > 0 })) });
});

adminRoutes.get('/chapters/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Chapitre introuvable.' });
  res.json({ chapter: { ...row, isFree: Boolean(row.is_free) } });
});

adminRoutes.post('/books/:id/chapters', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(Number(req.params.id));
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  const next = db.prepare('SELECT COALESCE(MAX(number),0) + 1 AS n FROM chapters WHERE book_id = ?').get(book.id).n;
  const text = String(req.body?.text || '');
  const statut = req.body?.publish === false ? 'draft' : 'published';
  const info = db
    .prepare('INSERT INTO chapters (book_id, number, title, text, is_free, words, status, editorial_status) VALUES (?,?,?,?,?,?,?,?)')
    .run(
      book.id,
      Number(req.body?.number) || next,
      String(req.body?.title || `Chapitre ${next}`).trim(),
      text,
      req.body?.isFree ? 1 : 0,
      countWords(text),
      statut,
      statut,
    );
  const cree = db.prepare('SELECT * FROM chapters WHERE id = ?').get(info.lastInsertRowid);
  /* version 1 : l'état d'origine est toujours récupérable */
  enregistrerVersion(cree.id, cree, req.user?.id, 'création');
  journaliser(req, 'chapter.create', 'chapter', cree.id, null, {
    title: cree.title, words: cree.words, status: cree.status,
  });
  res.status(201).json({ chapter: cree });
});

/* ---------- v55 : journal des actions sensibles (Phase 9) ---------- */
function journaliser(req, action, objet, objetId, avant, apres) {
  try {
    db.prepare(
      `INSERT INTO admin_audit_log (actor_id, actor_email, action, object, object_id, before_json, after_json, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      req.user?.id ?? null,
      String(req.user?.email || ''),
      action,
      objet,
      objetId ?? null,
      avant ? JSON.stringify(avant).slice(0, 4000) : '',
      apres ? JSON.stringify(apres).slice(0, 4000) : '',
      String(req.ip || '').slice(0, 60),
    );
  } catch (err) {
    console.error('[journal]', err.message);
  }
}

/* ---------- v55 : versions de chapitre (Phase 9) ---------- */
function enregistrerVersion(chapterId, contenu, acteurId, note = '') {
  const suivante =
    (db
      .prepare('SELECT COALESCE(MAX(version_no), 0) AS v FROM chapter_versions WHERE chapter_id = ?')
      .get(chapterId).v || 0) + 1;
  db.prepare(
    `INSERT INTO chapter_versions (chapter_id, version_no, title, text, words, status, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    chapterId,
    suivante,
    contenu.title || '',
    contenu.text || '',
    Number(contenu.words) || 0,
    contenu.status || 'draft',
    String(note).slice(0, 200),
    acteurId ?? null,
  );
  return suivante;
}

const STATUTS_EDITORIAUX = ['draft', 'review', 'published', 'archived'];

adminRoutes.patch('/chapters/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Chapitre introuvable.' });
  const text = req.body?.text ?? row.text;
  const title = req.body?.title ?? row.title;

  /* v55 — statut éditorial : DRAFT / REVIEW / PUBLISHED / ARCHIVED.
     `status` reste la seule source de vérité pour la visibilité publique :
     seul 'published' rend le chapitre visible. Les quatre états éditoriaux
     sont conservés à part, ce qui évite de reconstruire la table (SQLite ne
     sait pas modifier une contrainte CHECK existante). */
  let editorial = row.editorial_status || (row.status === 'published' ? 'published' : 'draft');
  if (req.body?.editorialStatus !== undefined) {
    if (!STATUTS_EDITORIAUX.includes(req.body.editorialStatus)) {
      return res.status(400).json({
        error: `Statut éditorial inconnu. Valeurs acceptées : ${STATUTS_EDITORIAUX.join(', ')}.`,
        accepted: STATUTS_EDITORIAUX,
      });
    }
    editorial = req.body.editorialStatus;
  }
  if (req.body?.status !== undefined && req.body?.editorialStatus === undefined) {
    editorial = req.body.status === 'published' ? 'published' : 'draft';
  }

  const publie = editorial === 'published' && !row.archived_at;
  const statutTechnique = publie ? 'published' : 'draft';

  db.prepare(`UPDATE chapters SET number=?, title=?, text=?, is_free=?, words=?, status=?, editorial_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(
      req.body?.number != null ? Number(req.body.number) : row.number,
      title,
      text,
      req.body?.isFree != null ? (req.body.isFree ? 1 : 0) : row.is_free,
      countWords(text),
      statutTechnique,
      editorial,
      row.id,
    );

  const apres = db.prepare('SELECT * FROM chapters WHERE id = ?').get(row.id);

  /* Une version est enregistrée à chaque changement de contenu, pour pouvoir
     revenir en arrière sans rien perdre. */
  if (title !== row.title || text !== row.text) {
    const numero = enregistrerVersion(
      row.id,
      { title, text, words: countWords(text), status: editorial },
      req.user?.id,
      'enregistrement',
    );
    journaliser(req, 'chapter.update', 'chapter', row.id,
      { title: row.title, words: row.words, status: row.status, editorial: row.editorial_status },
      { title, words: countWords(text), status: editorial, version: numero });
  } else if (editorial !== (row.editorial_status || '')) {
    journaliser(req, 'chapter.status', 'chapter', row.id,
      { editorial: row.editorial_status }, { editorial });
  }

  res.json({ chapter: apres });
});

/** Liste des versions d'un chapitre, la plus récente d'abord. */
adminRoutes.get('/chapters/:id/versions', (req, res) => {
  const row = db.prepare('SELECT id FROM chapters WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Chapitre introuvable.' });
  const versions = db
    .prepare(
      `SELECT v.id, v.version_no, v.title, v.words, v.status, v.note, v.created_at,
              COALESCE(u.email, '') AS auteur
         FROM chapter_versions v
         LEFT JOIN users u ON u.id = v.created_by
        WHERE v.chapter_id = ?
        ORDER BY v.version_no DESC`,
    )
    .all(row.id);
  res.json({ versions });
});

/** Aperçu : renvoie le chapitre quel que soit son statut, réservé à l'admin. */
adminRoutes.get('/chapters/:id/preview', (req, res) => {
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Chapitre introuvable.' });
  const book = db.prepare('SELECT slug, title, author FROM books WHERE id = ?').get(row.book_id);
  res.json({
    preview: true,
    book,
    chapter: {
      id: row.id,
      number: row.number,
      title: row.title,
      text: row.text,
      words: row.words,
      isFree: Boolean(row.is_free),
      status: row.status,
      editorialStatus: row.editorial_status,
      visiblePubliquement: row.status === 'published',
    },
  });
});

/**
 * Restauration d'une version antérieure. On ne réécrit pas l'historique :
 * l'ancien contenu devient une NOUVELLE version, et les droits des acheteurs
 * ne bougent pas (ils portent sur le chapitre, pas sur un texte donné).
 */
adminRoutes.post('/chapters/:id/restore/:versionNo', (req, res) => {
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Chapitre introuvable.' });
  const version = db
    .prepare('SELECT * FROM chapter_versions WHERE chapter_id = ? AND version_no = ?')
    .get(row.id, Number(req.params.versionNo));
  if (!version) return res.status(404).json({ error: 'Version introuvable.' });

  db.prepare(
    `UPDATE chapters SET title = ?, text = ?, words = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).run(version.title, version.text, version.words, row.id);

  const numero = enregistrerVersion(
    row.id,
    { title: version.title, text: version.text, words: version.words, status: version.status },
    req.user?.id,
    `restauration de la version ${version.version_no}`,
  );

  journaliser(req, 'chapter.restore', 'chapter', row.id,
    { title: row.title, words: row.words },
    { titre: version.title, mots: version.words, depuis_version: version.version_no, nouvelle_version: numero });

  res.json({
    ok: true,
    restoredFrom: version.version_no,
    newVersion: numero,
    chapter: db.prepare('SELECT * FROM chapters WHERE id = ?').get(row.id),
  });
});

/** Journal des actions sensibles. */
adminRoutes.get('/audit', (req, res) => {
  const limite = Math.min(200, Math.max(1, Number(req.query.limit) || 60));
  const entrees = db
    .prepare(
      `SELECT id, actor_email, action, object, object_id, before_json, after_json, ip, created_at
         FROM admin_audit_log ORDER BY id DESC LIMIT ?`,
    )
    .all(limite);
  res.json({ entries: entrees });
});

/**
 * v53 — Suppression d'un chapitre : garde-fou.
 * `orders.chapter_id` est en ON DELETE CASCADE : supprimer un chapitre qui a été
 * commandé effacerait aussi les commandes (preuve de vente, montant, référence).
 * On refuse donc la suppression dès qu'une seule commande existe, et on propose
 * l'archivage à la place. La suppression reste possible sur un chapitre jamais vendu.
 */
adminRoutes.delete('/chapters/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Chapitre introuvable.' });

  const linked = db
    .prepare(
      `SELECT COUNT(*) AS orders,
              COALESCE(SUM(amount_xof), 0) AS revenue,
              SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid
         FROM orders WHERE chapter_id = ?`,
    )
    .get(row.id);

  if (linked.orders > 0) {
    journaliser(req, 'chapter.delete.refused', 'chapter', row.id,
      { title: row.title, orders: linked.orders, revenue: linked.revenue }, null);
    return res.status(409).json({
      error:
        `Suppression refusée : ce chapitre figure dans ${linked.orders} commande(s)` +
        ` (${linked.paid} payée(s), ${linked.revenue} FCFA encaissés).` +
        ' Le supprimer effacerait aussi ces commandes. Archivez-le à la place.',
      code: 'CHAPTER_SOLD',
      orders: linked.orders,
      paid: linked.paid,
      revenue: linked.revenue,
      suggestion: { route: 'POST /api/admin/chapters/:id/archive' },
    });
  }

  db.prepare('DELETE FROM chapters WHERE id = ?').run(row.id);
  journaliser(req, 'chapter.delete', 'chapter', row.id, { title: row.title, number: row.number }, null);
  res.json({ ok: true, deleted: true });
});

/**
 * v53 — Archivage : retire le chapitre du catalogue public sans rien effacer.
 * Le statut passe à 'draft' (toutes les routes publiques filtrent sur
 * 'published'), l'horodatage et la raison sont conservés, et les acheteurs
 * gardent leur commande intacte. Réversible avec /unarchive.
 */
adminRoutes.post('/chapters/:id/archive', (req, res) => {
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Chapitre introuvable.' });
  const reason = String(req.body?.reason || '').slice(0, 300);
  db.prepare(
    `UPDATE chapters
        SET status = 'draft', archived_at = CURRENT_TIMESTAMP,
            archived_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
  ).run(reason, row.id);
  journaliser(req, 'chapter.archive', 'chapter', row.id,
    { status: row.status, editorial: row.editorial_status }, { status: 'draft', editorial: 'draft', reason });
  res.json({
    ok: true,
    archived: true,
    chapter: db.prepare('SELECT * FROM chapters WHERE id = ?').get(row.id),
  });
});

adminRoutes.post('/chapters/:id/unarchive', (req, res) => {
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Chapitre introuvable.' });
  db.prepare(
    `UPDATE chapters
        SET archived_at = NULL, archived_reason = '', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
  ).run(row.id);
  journaliser(req, 'chapter.unarchive', 'chapter', row.id, { archived_at: row.archived_at }, { archived_at: null });
  res.json({
    ok: true,
    restored: true,
    note: "Le chapitre est désarchivé mais reste en brouillon : repassez son statut à 'published' pour le remettre en ligne.",
    chapter: db.prepare('SELECT * FROM chapters WHERE id = ?').get(row.id),
  });
});

/** Import d'un manuscrit complet : découpage sur les titres « Chapitre N ». */
function splitManuscript(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
  const lines = text.split('\n');
  const marker = /^\s*(?:chapitre|chap\.?|ch\.)\s*([0-9]{1,3}|premier|deuxi[èe]me|troisi[èe]me|quatri[èe]me|cinqui[èe]me|sixi[èe]me|septi[èe]me|huiti[èe]me|neuvi[èe]me|dixi[èe]me)\b[\s:.\-–—]*(.*)$/i;
  const parts = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(marker);
    const isTitleLike = m && line.trim().length < 90 && !/[.!?]$/.test(line.trim());
    if (isTitleLike) {
      if (current) parts.push(current);
      current = { label: m[2]?.trim() || '', title: m[2]?.trim() || line.trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      current = { label: '', title: 'Début', lines: [line] };
    }
  }
  if (current) parts.push(current);
  return parts
    .map((p, i) => ({
      number: i + 1,
      title: p.title || `Chapitre ${i + 1}`,
      text: p.lines.join('\n').trim(),
    }))
    .filter((p) => p.text.length > 0);
}

adminRoutes.post('/books/:id/import', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(Number(req.params.id));
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });
  const parts = splitManuscript(req.body?.text || '');
  if (!parts.length) return res.status(400).json({ error: 'Aucun chapitre détecté. Vérifiez que les titres commencent par « Chapitre 1 », « Chapitre 2 »…' });

  const mode = req.body?.mode === 'append' ? 'append' : 'replace';
  const startNumber = mode === 'append'
    ? db.prepare('SELECT COALESCE(MAX(number),0) AS n FROM chapters WHERE book_id = ?').get(book.id).n
    : 0;

  const tx = db.transaction(() => {
    if (mode === 'replace') db.prepare('DELETE FROM chapters WHERE book_id = ?').run(book.id);
    const insert = db.prepare('INSERT INTO chapters (book_id, number, title, text, is_free, words, status) VALUES (?,?,?,?,?,?,?)');
    parts.forEach((p, i) => {
      const number = startNumber + i + 1;
      insert.run(book.id, number, p.title.slice(0, 160), p.text, number <= book.free_chapters ? 1 : 0, countWords(p.text), 'published');
    });
  });
  tx();

  res.json({
    ok: true,
    imported: parts.length,
    mode,
    chapters: db.prepare('SELECT number, title, words FROM chapters WHERE book_id = ? ORDER BY number').all(book.id),
  });
});

/* --------------------------------- Messages -------------------------------- */

adminRoutes.get('/messages', (req, res) => {
  const rows = db.prepare('SELECT * FROM messages ORDER BY created_at DESC, id DESC').all();
  res.json({ messages: rows });
});

adminRoutes.patch('/messages/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Message introuvable.' });
  const status = ['new', 'read', 'answered'].includes(req.body?.status) ? req.body.status : row.status;
  const reply = req.body?.reply != null ? String(req.body.reply) : row.reply;
  db.prepare('UPDATE messages SET status = ?, reply = ?, answered_at = ? WHERE id = ?')
    .run(status, reply, status === 'answered' ? new Date().toISOString() : row.answered_at, row.id);
  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(row.id);
  const emailed = false;
  if (status === 'answered' && reply && config.resendKey) {
    sendReplyEmail(updated).catch((err) => console.error('[mail]', err.message));
  }
  res.json({ message: updated, emailed: Boolean(config.resendKey) });
});

async function sendReplyEmail(message) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.resendKey}` },
    body: JSON.stringify({
      from: config.mailFrom,
      to: message.email,
      subject: `Réponse à votre message — ${getSettings().siteName}`,
      text: message.reply,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

/* ---------------------------------- Ventes --------------------------------- */

adminRoutes.get('/orders', (req, res) => {
  const status = String(req.query.status || '');
  const rows = db
    .prepare(`
      SELECT o.*, b.title AS book_title, b.slug AS book_slug, c.number AS chapter_number, c.title AS chapter_title,
             u.email AS user_email, u.name AS user_name
      FROM orders o JOIN books b ON b.id = o.book_id JOIN chapters c ON c.id = o.chapter_id JOIN users u ON u.id = o.user_id
      ${status ? 'WHERE o.status = ?' : ''}
      ORDER BY CASE o.status WHEN 'pending' THEN 0 ELSE 1 END, o.created_at DESC`)
    .all(...(status ? [status] : []));
  res.json({ orders: rows });
});

/* Export CSV des ventes : séparateur « ; » et BOM, ouvert directement dans Excel FR. */
adminRoutes.get('/orders/export.csv', (req, res) => {
  const rows = db
    .prepare(`
      SELECT o.reference, o.created_at, o.status, o.amount_xof, o.method, o.provider_ref, o.validated_at, o.note,
             b.title AS book_title, c.number AS chapter_number, c.title AS chapter_title,
             u.email AS user_email, u.name AS user_name
      FROM orders o
      JOIN books b ON b.id = o.book_id
      JOIN chapters c ON c.id = o.chapter_id
      JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC`)
    .all();

  const fr = (value) => {
    const v = value == null ? '' : String(value);
    return `"${v.replace(/"/g, '""')}"`;
  };
  const lines = [
    ['Référence', 'Date', 'Statut', 'Montant FCFA', 'Moyen', 'Référence paiement', 'Validé le', 'Note', 'Roman', 'Chapitre', 'Titre chapitre', 'Lecteur', 'E-mail'].map(fr).join(';'),
  ];
  for (const r of rows) {
    lines.push(
      [
        r.reference,
        r.created_at,
        r.status,
        r.amount_xof,
        r.method,
        r.provider_ref,
        r.validated_at,
        r.note,
        r.book_title,
        r.chapter_number,
        r.chapter_title,
        r.user_name,
        r.user_email,
      ]
        .map(fr)
        .join(';'),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ventes-book-forever-${stamp}.csv"`);
  res.send('\uFEFF' + lines.join('\r\n'));
});

adminRoutes.post('/orders/:id/validate', (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Commande introuvable.' });
  if (row.status === 'paid') return res.status(409).json({ error: 'Commande déjà validée.' });
  if (['wave_api', 'orange_api', 'mtn_momo', 'moov', 'cinetpay', 'card'].includes(row.method)) {
    return res.status(400).json({ error: 'Un paiement automatique ne peut pas être validé à la main.' });
  }
  const accessDays = Math.max(1, Number(getSettings().accessDays) || 30);
  /* v55 : un achat de chapitre est définitif ; expires_at reste NULL. */
  const permanentAccess = process.env.PURCHASE_ACCESS !== 'days';
  const expiration = permanentAccess ? 'NULL' : `date('now', '+${accessDays} days')`;
  db.prepare(`UPDATE orders SET status = 'paid', validated_at = CURRENT_TIMESTAMP,
              expires_at = ${expiration},
              verification_status = 'verified',
              channel = COALESCE(NULLIF(channel, ''), 'WEB_PAYMENT'),
              provider = CASE method
                WHEN 'wave_link' THEN 'wave' WHEN 'wave_api' THEN 'wave'
                WHEN 'orange_money_direct' THEN 'orange' WHEN 'orange_api' THEN 'orange'
                WHEN 'cinetpay' THEN 'cinetpay' WHEN 'card' THEN 'card' ELSE 'manual' END,
              note = ? WHERE id = ?`)
    .run(String(req.body?.note || 'Validé manuellement après vérification du relevé').slice(0, 300), row.id);

  // Phase 6 : Génération automatique du reçu électronique certifié
  const receipt = generateReceiptForOrder(row.id);

  // Si c'est une commande d'intégrale de roman, débloquer tous les chapitres du livre
  if (row.note && row.note.includes('Intégrale')) {
    const allChapters = db.prepare("SELECT id FROM chapters WHERE book_id = ? AND is_free = 0 AND status = 'published'").all(row.book_id);
    for (const ch of allChapters) {
      if (ch.id !== row.chapter_id) {
        db.prepare(`
          INSERT INTO orders (reference, user_id, book_id, chapter_id, amount_xof, method, status, validated_at, expires_at, note)
          VALUES (?, ?, ?, ?, 0, ?, 'paid', CURRENT_TIMESTAMP, ${expiration}, 'Inclus dans Intégrale')
          ON CONFLICT(reference) DO UPDATE SET status = 'paid', validated_at = CURRENT_TIMESTAMP, expires_at = ${expiration}
        `).run(`${row.reference}-CH${ch.id}`, row.user_id, row.book_id, ch.id, row.method);
      }
    }
  }

  res.json({ ok: true, order: db.prepare('SELECT * FROM orders WHERE id = ?').get(row.id), receipt });
});

adminRoutes.post('/orders/:id/reject', (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Commande introuvable.' });
  db.prepare("UPDATE orders SET status = 'rejected', note = ? WHERE id = ?")
    .run(String(req.body?.note || 'Non retrouvée sur le relevé').slice(0, 300), row.id);
  res.json({ ok: true });
});

adminRoutes.post('/orders/:id/refund', (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Commande introuvable.' });
  db.prepare("UPDATE orders SET status = 'refunded', note = ? WHERE id = ?")
    .run(String(req.body?.note || 'Remboursé').slice(0, 300), row.id);
  
  // Met à jour le reçu associé
  db.prepare("UPDATE receipts SET status = 'refunded' WHERE order_id = ?").run(row.id);
  
  res.json({ ok: true });
});

/* -------------------------------- Réclamations ------------------------------- */

adminRoutes.get('/claims', (req, res) => {
  const status = String(req.query.status || '');
  const rows = listAdminClaims(status);
  res.json({ claims: rows });
});

adminRoutes.patch('/claims/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM claims WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Dossier de réclamation introuvable.' });

  const allowedStatuses = ['OUVERT', 'EN_COURS', 'EN_ATTENTE', 'RESOLU', 'FERME'];
  const status = allowedStatuses.includes(req.body?.status) ? req.body.status : row.status;
  const adminReply = req.body?.adminReply != null ? String(req.body.adminReply).slice(0, 5000) : row.admin_reply;
  const resolvedAt = ['RESOLU', 'FERME'].includes(status) ? new Date().toISOString() : row.resolved_at;

  db.prepare(`
    UPDATE claims
    SET status = ?, admin_reply = ?, updated_at = CURRENT_TIMESTAMP, resolved_at = ?
    WHERE id = ?
  `).run(status, adminReply, resolvedAt, id);

  res.json({ claim: db.prepare('SELECT * FROM claims WHERE id = ?').get(id) });
});

/* --------------------------------- Réglages -------------------------------- */

adminRoutes.get('/settings', (req, res) => res.json({ settings: getSettings(), providers: { resend: Boolean(config.resendKey) } }));

adminRoutes.patch('/settings', (req, res) => {
  const allowed = ['siteName', 'siteTagline', 'contactEmail', 'contactPhone', 'waveLink', 'orangeNumber',
    'priceXof', 'freeChapters', 'address', 'publisher', 'waveEnabled', 'orangeEnabled', 'supportHours',
    'monthlyPrice', 'monthlyDays', 'passPrice', 'passDays', 'packPrice', 'packCredits', 'accessDays',
    'referralTarget', 'referralReward', 'channelUrl',
    'spotlightBook', 'spotlightChapter', 'spotlightUntil'];
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const tx = db.transaction(() => {
    for (const key of allowed) {
      if (req.body?.[key] != null) upsert.run(key, String(req.body[key]));
    }
  });
  tx();
  res.json({ settings: getSettings() });
});

/* ---------------------------------- Lecteurs -------------------------------- */

adminRoutes.get('/users', (req, res) => {
  const rows = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows });
});

/** Ajout d'une couverture déposée depuis la console (data URL, limité à 3 Mo). */
adminRoutes.post('/covers', (req, res) => {
  const dataUrl = String(req.body?.dataUrl || '');
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Image invalide (PNG, JPEG ou WebP attendu).' });
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'Image trop lourde (3 Mo maximum).' });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = `${slugify(req.body?.name || 'couverture')}-${Date.now().toString(36)}.${ext}`;
  const dir = path.join(config.uploadsDir, 'covers');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buffer);
  res.status(201).json({ url: `/media/covers/${name}` });
});

/* ---------- v16 : abonnements ---------- */
adminRoutes.get('/subscriptions', (req, res) => {
  const rows = db
    .prepare(`SELECT s.*, u.email, u.name FROM subscriptions s JOIN users u ON u.id = s.user_id
              ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.id DESC LIMIT 200`)
    .all();
  res.json({ subscriptions: rows });
});

adminRoutes.post('/subscriptions/:id/validate', (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(Number(req.params.id));
  if (!sub) return res.status(404).json({ error: 'Abonnement introuvable.' });
  const days = Math.max(1, Number(sub.days) || (sub.plan === 'week' ? 7 : 30));
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 3600 * 1000);
  db.prepare(`UPDATE subscriptions SET status = 'active', period_start = ?, period_end = ?,
              validated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), sub.id);
  res.json({ ok: true, days, periodEnd: end.toISOString().slice(0, 10) });
});

/* ---------- v22 : packs de crédits ---------- */

adminRoutes.get('/credits', (req, res) => {
  const rows = db
    .prepare(`SELECT co.*, u.email, u.name,
                     (SELECT COUNT(*) FROM credit_uses cu WHERE cu.credit_order_id = co.id) AS used
              FROM credit_orders co JOIN users u ON u.id = co.user_id
              ORDER BY CASE co.status WHEN 'pending' THEN 0 ELSE 1 END, co.id DESC LIMIT 200`)
    .all();
  res.json({ orders: rows });
});

adminRoutes.post('/credits/:id/validate', (req, res) => {
  const row = db.prepare('SELECT * FROM credit_orders WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Pack introuvable.' });
  if (row.status === 'active') return res.status(409).json({ error: 'Pack déjà activé.' });
  db.prepare("UPDATE credit_orders SET status = 'active', validated_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
  res.json({ ok: true, credits: row.credits });
});

adminRoutes.post('/credits/:id/reject', (req, res) => {
  const row = db.prepare('SELECT * FROM credit_orders WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Pack introuvable.' });
  db.prepare("UPDATE credit_orders SET status = 'rejected', validated_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
  res.json({ ok: true });
});

/** Crédit offert à la main (geste commercial, dédommagement). */
adminRoutes.post('/users/:id/credits', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Compte introuvable.' });
  const credits = Math.min(20, Math.max(1, Number(req.body?.credits) || 1));
  const granted = grantCredits(user.id, credits, 'geste', String(req.body?.note || 'Geste commercial').slice(0, 200));
  res.json({ ok: true, credits: granted });
});

adminRoutes.post('/subscriptions/:id/reject', (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(Number(req.params.id));
  if (!sub) return res.status(404).json({ error: 'Abonnement introuvable.' });
  db.prepare("UPDATE subscriptions SET status = 'rejected', validated_at = CURRENT_TIMESTAMP WHERE id = ?").run(sub.id);
  res.json({ ok: true });
});

/* ---------- v16 : candidatures d'auteur ---------- */
adminRoutes.get('/authors', (req, res) => {
  const rows = db
    .prepare(`SELECT id, email, name, pen_name, bio, author_status, author_requested_at
              FROM users WHERE author_status <> '' ORDER BY CASE author_status WHEN 'pending' THEN 0 ELSE 1 END, id DESC`)
    .all();
  res.json({ authors: rows });
});

adminRoutes.post('/authors/:id/approve', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Compte introuvable.' });
  db.prepare("UPDATE users SET author_status = 'approved' WHERE id = ?").run(user.id);
  res.json({ ok: true });
});

adminRoutes.post('/authors/:id/reject', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Compte introuvable.' });
  db.prepare("UPDATE users SET author_status = 'rejected' WHERE id = ?").run(user.id);
  res.json({ ok: true });
});


/* -------- Jeu-concours « 20 romans offerts » -------- */

adminRoutes.get('/contest', (req, res) => {
  res.json({ entries: listContestEntries(), stats: contestStats() });
});

adminRoutes.get('/contest.csv', (req, res) => {
  const rows = listContestEntries();
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    ['place', 'statut', 'nom', 'email', 'telephone', 'roman', 'code', 'inscrit_le'].map(esc).join(';'),
    ...rows.map((r) =>
      [r.position, r.status, r.name, r.email, r.phone, r.book_slug, r.code, r.created_at].map(esc).join(';'),
    ),
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="concours-20-romans.csv"');
  res.send(`\uFEFF${csv}`);
});
