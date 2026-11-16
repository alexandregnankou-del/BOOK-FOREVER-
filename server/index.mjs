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
app.get(/^\/(?!api\/).*/, (req, res, next) => {
  if (['/sw.js', '/manifest.webmanifest'].includes(req.path)) return next();
  if (!fs.existsSync(indexHtml)) {
    return res
      .status(503)
      .type('text/plain')
      .send('Le site n’est pas encore compilé. Lancez « npm run build ».');
  }
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(indexHtml);
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
