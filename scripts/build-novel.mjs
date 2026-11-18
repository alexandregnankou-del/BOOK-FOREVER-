/*
  Assemble un roman écrit en Markdown (roman/livre/*.md) en fichier de contenu
  pour la base : server/seed/<slug>.json.

  Usage : node scripts/build-novel.mjs si-je-t-aimais-au-present
  Les chapitres sont lus dans roman/livre/ch01.md, ch02.md, ... et le titre du
  chapitre est pris sur la première ligne « # Chapitre … ».
*/
import fs from 'node:fs';
import path from 'node:path';
import config from '../server/config.mjs';

const slug = process.argv[2] || 'si-je-t-aimais-au-present';
const livreDir = path.join(config.rootDir, 'roman', 'livre');
const metaFile = path.join(livreDir, 'meta.json');

if (!fs.existsSync(metaFile)) {
  console.error(`[roman] meta.json introuvable dans ${livreDir}`);
  process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
const files = fs
  .readdirSync(livreDir)
  .filter((name) => /^ch\d+\.md$/.test(name))
  .sort();

const chapters = files.map((file, index) => {
  const raw = fs.readFileSync(path.join(livreDir, file), 'utf8').replace(/\r/g, '');
  const lines = raw.split('\n');
  const heading = lines.find((line) => line.startsWith('# ')) || '';
  const title = heading.replace(/^#\s*/, '').replace(/^Chapitre\s*\d+\s*[—–-]\s*/i, '').trim()
    || `Chapitre ${index + 1}`;
  const body = lines
    .filter((line) => !line.startsWith('# '))
    .join('\n')
    .trim();
  return {
    number: index + 1,
    title,
    text: body,
    isFree: index < (meta.freeChapters ?? 2),
    words: body.split(/\s+/).filter(Boolean).length,
  };
});

const book = {
  slug,
  title: meta.title,
  author: meta.author,
  tagline: meta.tagline || '',
  synopsis: meta.synopsis || '',
  cover: meta.cover || '',
  categorySlug: meta.categorySlug || 'roman',
  categoryName: meta.categoryName || 'Roman',
  priceXof: meta.priceXof ?? 300,
  freeChapters: meta.freeChapters ?? 2,
  status: 'published',
  chapters,
};

const outFile = path.join(config.rootDir, 'server', 'seed', `${slug}.json`);
fs.writeFileSync(outFile, `${JSON.stringify({ books: [book] }, null, 2)}\n`, 'utf8');

const words = chapters.reduce((sum, ch) => sum + ch.words, 0);
console.log(`[roman] ${chapters.length} chapitres, ${words} mots → ${path.relative(config.rootDir, outFile)}`);
