import path from 'node:path';
import fs from 'node:fs';

const rootDir = path.resolve(import.meta.dirname, '..');
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(rootDir, 'data');

fs.mkdirSync(dataDir, { recursive: true });

export const config = {
  rootDir,
  dataDir,
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
