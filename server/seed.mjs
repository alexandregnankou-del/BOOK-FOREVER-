import fs from 'node:fs';
import path from 'node:path';
import config from './config.mjs';
import { db, seedSettings, countWords } from './db.mjs';
import { ensureAdmin } from './auth.mjs';

const seedDir = path.join(config.rootDir, 'server', 'seed');

/** Charge tous les fichiers de contenu : un roman peut vivre dans son propre JSON. */
function loadSeedBooks() {
  if (!fs.existsSync(seedDir)) return [];
  const files = fs.readdirSync(seedDir).filter((name) => name.endsWith('.json')).sort();
  const books = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(seedDir, file), 'utf8'));
      if (Array.isArray(data.books)) books.push(...data.books);
    } catch (err) {
      console.error(`[seed] ${file} ignoré : ${err.message}`);
    }
  }
  return books;
}

export function seedDatabase({ quiet = false } = {}) {
  seedSettings();
  ensureAdmin();

  const books = loadSeedBooks();

  if (!books.length) {
    if (!quiet) console.warn('[seed] aucun fichier de contenu, base initialisée vide.');
    return { books: 0, chapters: 0 };
  }
  const exists = db.prepare('SELECT id FROM books WHERE slug = ?');
  const insertBook = db.prepare(`
    INSERT INTO books (slug, title, author, tagline, synopsis, cover, category_slug, category_name,
                       price_xof, free_chapters, status, sort_order)
    VALUES (@slug, @title, @author, @tagline, @synopsis, @cover, @categorySlug, @categoryName,
            @priceXof, @freeChapters, @status, @sortOrder)`);
  const insertChapter = db.prepare(`
    INSERT INTO chapters (book_id, number, title, text, is_free, words, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);

  let bookCount = 0;
  let chapterCount = 0;

  const tx = db.transaction(() => {
    books.forEach((book, index) => {
      if (exists.get(book.slug)) return;
      const info = insertBook.run({
        slug: book.slug,
        title: book.title,
        author: book.author,
        tagline: book.tagline || '',
        synopsis: book.synopsis || '',
        cover: book.cover || '',
        categorySlug: book.categorySlug || 'roman',
        categoryName: book.categoryName || 'Roman',
        priceXof: book.priceXof ?? config.defaults.priceXof,
        freeChapters: book.freeChapters ?? config.defaults.freeChapters,
        status: book.status || 'published',
        sortOrder: index,
      });
      bookCount += 1;
      for (const ch of book.chapters || []) {
        insertChapter.run(
          info.lastInsertRowid,
          ch.number,
          ch.title || `Chapitre ${ch.number}`,
          ch.text || '',
          ch.isFree ? 1 : 0,
          ch.words || countWords(ch.text),
          ch.status || (ch.text ? 'published' : 'draft'),
        );
        chapterCount += 1;
      }
    });
  });
  tx();

  // Rattrapage : romans déjà en base → on complète les chapitres manquants ou
  // encore vides (import d'un manuscrit sans réinitialiser la base).
  const findBook = db.prepare('SELECT id FROM books WHERE slug = ?');
  const findChapter = db.prepare('SELECT id, text, status FROM chapters WHERE book_id = ? AND number = ?');
  const updateChapter = db.prepare(
    'UPDATE chapters SET title = ?, text = ?, is_free = ?, words = ?, status = ? WHERE id = ?',
  );
  let filled = 0;

  const tx2 = db.transaction(() => {
    for (const book of books) {
      const row = findBook.get(book.slug);
      if (!row) continue;
      for (const ch of book.chapters || []) {
        if (!ch.text) continue;
        const existing = findChapter.get(row.id, ch.number);
        if (!existing) {
          insertChapter.run(
            row.id,
            ch.number,
            ch.title || `Chapitre ${ch.number}`,
            ch.text,
            ch.isFree ? 1 : 0,
            ch.words || countWords(ch.text),
            ch.status || 'published',
          );
          filled += 1;
        } else if (!existing.text || existing.text.length < ch.text.length) {
          updateChapter.run(
            ch.title || `Chapitre ${ch.number}`,
            ch.text,
            ch.isFree ? 1 : 0,
            ch.words || countWords(ch.text),
            'published',
            existing.id,
          );
          filled += 1;
        }
      }
    }
  });
  tx2();

  if (!quiet) {
    console.log(`[seed] ${bookCount} roman(s), ${chapterCount} chapitre(s) ajoutés, ${filled} complété(s).`);
  }
  return { books: bookCount, chapters: chapterCount, filled };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
  const stats = db
    .prepare("SELECT (SELECT COUNT(*) FROM books) AS books, (SELECT COUNT(*) FROM chapters) AS chapters, (SELECT COUNT(*) FROM chapters WHERE text <> '') AS withText")
    .get();
  console.log('[seed] état:', stats);
}
