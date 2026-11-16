import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import config from './config.mjs';
import { db, publicSite } from './db.mjs';
import { seedDatabase } from './seed.mjs';
import { publicRoutes } from './routes/public.mjs';
import { authRoutes } from './routes/auth.mjs';
import { meRoutes } from './routes/me.mjs';
import { adminRoutes } from './routes/admin.mjs';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '6mb' }));
app.use(cookieParser());

seedDatabase({ quiet: true });

app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api', (req, res) => res.json({ name: 'BOOK FOREVER API', version: '1.0.0' }));

/* APK : type MIME Android + téléchargement explicite. */
app.get('/download/:file', (req, res, next) => {
  const file = req.params.file;
  if (!/^[a-z0-9.\-]+\.apk$/i.test(file)) return next();
  const target = path.join(config.publicDir, 'download', file);
  if (!fs.existsSync(target)) return next();
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
  res.sendFile(target);
});

/* Fichiers statiques : médias, polices, icônes, service worker. */
app.use(
  express.static(config.publicDir, {
    index: false,
    maxAge: '30d',
    setHeaders(res, filePath) {
      if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);
app.use('/assets', express.static(path.join(config.distDir, 'assets'), { maxAge: '1y', immutable: true }));

/* Alias historique utilisé par le site précédent. */
app.get('/site.json', (req, res) => res.json(publicSite()));

const indexHtml = path.join(config.distDir, 'index.html');

/* Aperçu de partage (WhatsApp, Facebook…) : titre, résumé et couverture réels. */
function buildMeta(req) {
  const origin = `${req.protocol}://${req.get('host')}`;
  const site = publicSite();
  let title = `${site.siteName} — Lire autrement, chapitre après chapitre`;
  let description =
    'Deux chapitres offerts par roman. La suite pour 300 FCFA le chapitre, par Wave ou Orange Money.';
  let image = `${origin}/media/covers/light-in-the-dark.webp`;

  const bookMatch = req.path.match(/^\/roman\/([a-z0-9-]+)$/);
  if (bookMatch) {
    const book = db
      .prepare("SELECT title, author, tagline, synopsis, cover FROM books WHERE slug = ? AND status = 'published'")
      .get(bookMatch[1]);
    if (book) {
      title = `${book.title} — ${book.author}`;
      description = book.tagline || book.synopsis || description;
      if (book.cover) image = `${origin}${book.cover}`;
    }
  }

  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const tags = [
    '<meta property="og:site_name" content="' + esc(site.siteName) + '" />',
    '<meta property="og:type" content="website" />',
    '<meta property="og:title" content="' + esc(title) + '" />',
    '<meta property="og:description" content="' + esc(description.slice(0, 200)) + '" />',
    '<meta property="og:image" content="' + esc(image) + '" />',
    '<meta property="og:url" content="' + esc(origin + req.path) + '" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:title" content="' + esc(title) + '" />',
    '<meta name="twitter:image" content="' + esc(image) + '" />',
  ].join('\n    ');
  return { tags, title: esc(title) };
}

/* Un fichier demandé (extension ou dossier de téléchargement) ne doit jamais
   recevoir la page HTML du site : on répond 404 pour éviter de faire passer
   un .apk manquant pour le site. */
const FILE_LIKE = /^\/(download|media|covers|icons|assets|fonts|screenshots)\//i;
const HAS_EXTENSION = /\/[^/]+\.[a-z0-9]{2,5}$/i;

app.get(/^\/(?!api\/).*/, (req, res, next) => {
  if (['/sw.js', '/manifest.webmanifest'].includes(req.path)) return next();
  if (FILE_LIKE.test(req.path) || HAS_EXTENSION.test(req.path)) {
    return res.status(404).type('text/plain').send('Fichier introuvable.');
  }
  if (!fs.existsSync(indexHtml)) {
    return res
      .status(503)
      .type('text/plain')
      .send('Le site n’est pas encore compilé. Lancez « npm run build ».');
  }
  res.setHeader('Cache-Control', 'no-store');
  let html = fs.readFileSync(indexHtml, 'utf8');
  if (html.includes('<!--meta-start-->')) {
    const { tags, title } = buildMeta(req);
    html = html.replace(/<!--meta-start-->[\s\S]*?<!--meta-end-->/, tags);
    html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>');
  }
  res.type('html').send(html);
});

app.use((req, res) => res.status(404).json({ error: 'Ressource introuvable.' }));

app.use((err, req, res, next) => {
  console.error('[api]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erreur interne. L’incident a été journalisé.' });
});

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

const server = app.listen(config.port, () => {
  const stats = db
    .prepare("SELECT (SELECT COUNT(*) FROM books) AS books, (SELECT COUNT(*) FROM chapters) AS chapters, (SELECT COUNT(*) FROM chapters WHERE text <> '') AS withText, (SELECT COUNT(*) FROM users) AS users")
    .get();
  console.log(`[book-forever] http://localhost:${config.port} — ${stats.books} romans · ${stats.chapters} chapitres (${stats.withText} avec texte) · ${stats.users} comptes`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
