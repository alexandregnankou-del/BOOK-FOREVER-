import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const rootDir = path.resolve(import.meta.dirname, '..');

/** Le dossier de données doit être inscriptible : sur certaines plateformes
 *  le dossier de l'application est en lecture seule. On essaie dans l'ordre
 *  DATA_DIR, ./data, puis le dossier temporaire du système. */
function resolveDataDir() {
  const candidates = [
    process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null,
    path.join(rootDir, 'data'),
    path.join(os.tmpdir(), 'book-forever-data'),
  ].filter(Boolean);

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      continue;
    }
  }
  throw new Error('Aucun dossier de données inscriptible trouvé');
}

const dataDir = resolveDataDir();

/** Couvertures ajoutées depuis la console : elles doivent vivre avec la base,
 *  sinon un redéploiement les efface même si le disque est monté. */
const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(path.join(uploadsDir, 'covers'), { recursive: true });

/* Version affichée par /api/health et par le pied de page : un seul endroit à
   changer pour éviter les libellés contradictoires (l'ancienne page /installer
   annonçait encore « version 20 »). */
export const APP_VERSION = '1.51.0';
export const APP_RELEASE = 'v51';

/* En production, on refuse de démarrer avec les valeurs de secours : un secret
   JWT par défaut permettrait de forger un jeton administrateur. */
if (process.env.NODE_ENV === 'production') {
  const missing = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) missing.push('JWT_SECRET');
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 10) missing.push('ADMIN_PASSWORD');
  if (missing.length) {
    throw new Error(`Variables d'environnement manquantes ou trop faibles : ${missing.join(', ')}`);
  }
}

export const config = {
  rootDir,
  dataDir,
  uploadsDir,
  dbFile: path.join(dataDir, 'book-forever.db'),
  publicDir: path.join(rootDir, 'public'),
  distDir: path.join(rootDir, 'dist'),
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  adminEmail: process.env.ADMIN_EMAIL || 'alexadisenhouse@gmail.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'Adisen2026!',
  adminName: process.env.ADMIN_NAME || 'ADISEN HOUSE',
  isProd: process.env.NODE_ENV === 'production',
  resendKey: process.env.RESEND_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || 'BOOK FOREVER <contact@bookforever.ci>',
  defaults: {
    contactEmail: process.env.CONTACT_EMAIL || 'alexandregnankou@gmail.com',
    contactPhone: process.env.CONTACT_PHONE || '+225 0703025007',
    waveLink: process.env.WAVE_LINK || 'https://pay.wave.com/m/M_ci_WwpCpr9rnJw1/c/ci/',
    orangeNumber: process.env.ORANGE_NUMBER || '0706486904',
    priceXof: Number(process.env.PRICE_XOF || 300),
    freeChapters: Number(process.env.FREE_CHAPTERS || 2),
  },
};

export default config;
