import fs from 'node:fs';
import path from 'node:path';
import config from './config.mjs';
import { db, seedSettings, countWords } from './db.mjs';
import { ensureAdmin } from './auth.mjs';

const seedFile = path.join(config.rootDir, 'server', 'seed', 'books.json');

export function seedDatabase({ quiet = false } = {}) {
  seedSettings();
  ensureAdmin();

  if (!fs.existsSync(seedFile)) {
    if (!quiet) console.warn('[seed] aucun fichier de contenu, base initialisée vide.');
    return { books: 0, chapters: 0 };
  }

  const { books } = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
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

  if (!quiet) console.log(`[seed] ${bookCount} roman(s), ${chapterCount} chapitre(s) ajoutés.`);
  return { books: bookCount, chapters: chapterCount };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
  const stats = db
    .prepare("SELECT (SELECT COUNT(*) FROM books) AS books, (SELECT COUNT(*) FROM chapters) AS chapters, (SELECT COUNT(*) FROM chapters WHERE text <> '') AS withText")
    .get();
  console.log('[seed] état:', stats);
}
