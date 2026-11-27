import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const rootDir = path.resolve(import.meta.dirname, '..');

/** Disque que Render monte quand on active l'option payante. */
const RENDER_DISK = '/var/data';

const isTmpPath = (p) => /^\/(tmp|var\/tmp)(\/|$)/.test(p);

/** Un vrai disque monté a un numéro de périphérique différent de son parent.
 *  Un simple dossier créé à la main ne trompe donc pas la détection. */
function isRealMount(target) {
  try {
    return fs.statSync(target).dev !== fs.statSync(path.dirname(target)).dev;
  } catch {
    return false;
  }
}

/** Le dossier de données doit être inscriptible : sur certaines plateformes
 *  le dossier de l'application est en lecture seule. On essaie dans l'ordre
 *  le disque Render, DATA_DIR, ./data, puis le dossier temporaire du système.
 *
 *  Le disque monté passe avant un DATA_DIR temporaire : le jour où l'option
 *  payante est activée, l'application bascule toute seule et n'a plus besoin
 *  d'être reconfigurée — c'est ce qui évite de croire à une sauvegarde alors
 *  que les fichiers partent encore dans /tmp. */
function resolveDataDir() {
  const explicit = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null;
  const diskReady = fs.existsSync(RENDER_DISK) && isRealMount(RENDER_DISK);

  const candidates = [];
  if (diskReady) candidates.push(RENDER_DISK);
  if (explicit && !(diskReady && isTmpPath(explicit))) candidates.push(explicit);
  candidates.push(path.join(rootDir, 'data'));
  if (!diskReady) candidates.push(path.join(os.tmpdir(), 'book-forever-data'));

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

/** Vrai seulement si les fichiers survivent à un redémarrage. */
const storagePersistent = isRealMount(dataDir) || !isTmpPath(dataDir);

/** Couvertures ajoutées depuis la console : elles doivent vivre avec la base,
 *  sinon un redéploiement les efface même si le disque est monté. */
const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(path.join(uploadsDir, 'covers'), { recursive: true });

/* Version affichée par /api/health et par le pied de page : un seul endroit à
   changer pour éviter les libellés contradictoires (l'ancienne page /installer
   annonçait encore « version 20 »). */
/* Offre de lancement « 20 romans offerts ». Les dates sont en UTC :
   Abidjan est à l'heure universelle toute l'année, donc pas de décalage. */
export const CONTEST = {
  start: process.env.CONTEST_START || '2026-12-01T00:00:00Z',
  end: process.env.CONTEST_END || '2026-12-19T23:59:59Z',
  announce: process.env.CONTEST_ANNOUNCE || '2026-12-21T12:00:00Z',
  directPlaces: Number(process.env.CONTEST_PLACES || 20),
};

export const APP_VERSION = '1.54.0';
export const APP_RELEASE = 'v54';

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
  storagePersistent,
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
    channelUrl: process.env.WHATSAPP_CHANNEL || 'https://whatsapp.com/channel/0029VbDDuHM5Ejy5yt0ylo1j',
    priceXof: Number(process.env.PRICE_XOF || 300),
    freeChapters: Number(process.env.FREE_CHAPTERS || 2),
  },
};

export default config;
