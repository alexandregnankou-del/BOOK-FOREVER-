import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import config, { APP_VERSION, APP_RELEASE } from './config.mjs';
import { recordBoot, normalizeCovers, db, publicSite } from './db.mjs';
import { seedDatabase } from './seed.mjs';
import { publicRoutes } from './routes/public.mjs';
import { authRoutes } from './routes/auth.mjs';
import { meRoutes } from './routes/me.mjs';
import { adminRoutes } from './routes/admin.mjs';
import { contestRoutes } from './routes/contest.mjs';
import { paymentRoutes } from './routes/payments.mjs';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
/* Le corps brut est conservé : indispensable pour vérifier une signature
   HMAC (webhooks de paiement) sur les octets réellement reçus. */
app.use(
  express.json({
    limit: '6mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(cookieParser());

/* En-têtes de sécurité. La politique de contenu n'autorise que nos propres
   scripts : le filet de secours de index.html est donc un fichier externe
   (/rescue.js) et non un script en ligne. */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "media-src 'self'",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  );
  if (config.isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

seedDatabase({ quiet: true });
normalizeCovers();

app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contest', contestRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/api', (req, res) => res.json({ name: 'BOOK FOREVER API', version: APP_VERSION, release: APP_RELEASE }));

/* Nom d'hôte public : PUBLIC_URL si défini, sinon celui de la requête. */
function originOf(req) {
  return (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

/* Référencement : sans ces deux fichiers, Google n'explore que la page d'accueil. */
app.get('/robots.txt', (req, res) => {
  res
    .type('text/plain')
    .send(
      ['User-agent: *', 'Allow: /', 'Disallow: /console', 'Disallow: /api/', `Sitemap: ${originOf(req)}/sitemap.xml`, ''].join('\n'),
    );
});

app.get('/sitemap.xml', (req, res) => {
  const origin = originOf(req);
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pages = [
    ['/', '1.0'], ['/bibliotheque', '0.9'], ['/videos', '0.7'], ['/auteurs', '0.7'], ['/a-propos', '0.5'],
    ['/telecharger', '0.8'], ['/contact', '0.4'], ['/reclamations', '0.4'], ['/regles', '0.3'],
    ['/cgv', '0.3'], ['/mentions-legales', '0.3'], ['/conditions', '0.2'], ['/confidentialite', '0.2'],
  ];
  const books = db.prepare("SELECT slug, updated_at FROM books WHERE status = 'published' ORDER BY sort_order, id").all();
  const urls = [
    ...pages.map(([p, pr]) => `  <url><loc>${esc(origin + p)}</loc><changefreq>weekly</changefreq><priority>${pr}</priority></url>`),
    ...books.map(
      (b) =>
        `  <url><loc>${esc(`${origin}/roman/${b.slug}`)}</loc><lastmod>${esc(String(b.updated_at || '').slice(0, 10))}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`,
    ),
  ].join('\n');
  res
    .type('application/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
});

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

/* Couvertures ajoutées depuis la console : stockées avec la base (disque persistant). */
app.use('/media/covers', express.static(path.join(config.uploadsDir, 'covers'), { maxAge: '30d' }));

/* Fichiers statiques : médias, polices, icônes, service worker. */
app.use(
  express.static(config.publicDir, {
    index: false,
    maxAge: '30d',
    setHeaders(res, filePath) {
      if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
      /* Vidéos : lecture en continu, donc cache court et requêtes Range. */
      if (filePath.endsWith('.mp4')) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
        res.setHeader('Accept-Ranges', 'bytes');
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

/* Routes réelles de l'application. Tout le reste doit répondre 404 : sinon
   Google indexe des adresses inexistantes comme de vraies pages (soft 404). */
const SPA_PAGES = new Set([
  '/', '/bibliotheque', '/videos', '/auteurs', '/devenir-auteur', '/espace-auteur', '/a-propos', '/telecharger', '/installer',
  '/compte', '/connexion', '/inscription', '/contact', '/regles', '/ecrire',
  '/conditions', '/confidentialite', '/mentions-legales', '/cgv', '/reclamations', '/assistance', '/console', '/jeu',
]);
const SPA_PATTERNS = [/^\/roman\/[a-z0-9-]+$/i, /^\/lire\/[a-z0-9-]+\/\d+$/i, /^\/console(\/[a-z0-9-]+)*$/i];
const isAppRoute = (p) => SPA_PAGES.has(p) || SPA_PATTERNS.some((re) => re.test(p));

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
  res.status(isAppRoute(req.path) ? 200 : 404);
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
  if (res.headersSent) return next(err);
  /* JSON mal formé ou trop volumineux : c'est la faute du client, pas un 500. */
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Données illisibles : le corps de la requête n’est pas un JSON valide.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Envoi trop volumineux.' });
  }
  console.error('[api]', err);
  res.status(500).json({ error: 'Erreur interne. L’incident a été journalisé.' });
});

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

recordBoot(config.dataDir);

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
