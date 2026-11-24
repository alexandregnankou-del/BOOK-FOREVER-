/**
 * Jeu-concours de lancement « 20 romans offerts ».
 *
 * Règles tenues ici, côté serveur, parce qu'un formulaire ne se contrôle pas
 * dans le navigateur :
 *   - les 20 premières inscriptions sont gagnantes d'office ;
 *   - au-delà, l'inscription est enregistrée « tirage » (aucune promesse) ;
 *   - un même courriel ne s'inscrit qu'une fois ;
 *   - les dates de l'offre viennent de la configuration, pas du client.
 */
import express from 'express';
import { CONTEST } from '../config.mjs';
import { db, contestStats, createContestEntry } from '../db.mjs';
import { rateLimiter } from '../ratelimit.mjs';

export const contestRoutes = express.Router();

/* Six inscriptions par heure et par adresse : assez pour une famille, trop
   peu pour un robot. */
const entryLimiter = rateLimiter({ name: 'contest', windowMs: 60 * 60 * 1000, max: 6 });

const isOpen = () => {
  const now = Date.now();
  return now >= Date.parse(CONTEST.start) && now <= Date.parse(CONTEST.end);
};

function publicState() {
  const stats = contestStats();
  return {
    start: CONTEST.start,
    end: CONTEST.end,
    announce: CONTEST.announce,
    directPlaces: CONTEST.directPlaces,
    taken: stats.total,
    directTaken: stats.directTaken,
    remaining: stats.remaining,
    open: isOpen(),
    serverTime: new Date().toISOString(),
  };
}

contestRoutes.get('/', (req, res) => {
  res.json(publicState());
});

contestRoutes.post('/', entryLimiter, (req, res) => {
  if (!isOpen()) {
    return res.status(403).json({
      error: "L'offre de lancement n'est pas ouverte. Revenez à partir du 1er décembre.",
    });
  }

  const name = String(req.body?.name || '').trim().slice(0, 80);
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 160);
  const phone = String(req.body?.phone || '').replace(/[^0-9+ ]/g, '').trim().slice(0, 20);
  const bookSlug = String(req.body?.bookSlug || '').trim().slice(0, 80);

  if (name.length < 2) return res.status(400).json({ error: 'Indiquez votre nom complet.' });
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
    return res.status(400).json({ error: 'Cette adresse e-mail ne semble pas valide.' });
  }
  if (phone.replace(/\D/g, '').length < 8) {
    return res.status(400).json({ error: 'Indiquez un numéro de téléphone joignable.' });
  }

  const book = db
    .prepare("SELECT slug, title FROM books WHERE slug = ? AND status = 'published'")
    .get(bookSlug);
  if (!book) return res.status(400).json({ error: 'Choisissez le roman que vous aimeriez recevoir.' });

  const already = db
    .prepare('SELECT position, status, code, book_slug FROM contest_entries WHERE lower(email) = ?')
    .get(email);
  if (already) {
    return res.status(409).json({
      error: `Cette adresse est déjà inscrite, place n°${already.position}. Votre code : ${already.code}.`,
      entry: already,
    });
  }

  try {
    const entry = createContestEntry({ name, email, phone, bookSlug });
    const stats = contestStats();
    return res.status(201).json({
      entry: { ...entry, bookSlug, bookTitle: book.title, name },
      remaining: stats.remaining,
      total: stats.total,
    });
  } catch (err) {
    console.error('[concours]', err);
    return res.status(500).json({ error: "L'inscription n'a pas pu être enregistrée. Réessayez." });
  }
});
